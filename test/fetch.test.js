// node --test test/fetch.test.js
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Fake md binary setup ──────────────────────────────────────────────────────
// Prepend a temp dir containing a fake `md` script to PATH.
// The script outputs $FAKE_MD_RESPONSE and exits $FAKE_MD_EXIT (default 0).
// This intercepts ALL spawnSync('md', ...) calls regardless of real md install.

let fakeDir
let origPath

before(() => {
  fakeDir = mkdtempSync(join(tmpdir(), 'F-fetch-test-'))
  origPath = process.env.PATH

  writeFileSync(join(fakeDir, 'md'), [
    '#!/bin/sh',
    'printf "%s" "$FAKE_MD_RESPONSE"',
    'exit "${FAKE_MD_EXIT:-0}"',
  ].join('\n'))
  chmodSync(join(fakeDir, 'md'), 0o755)

  process.env.PATH = fakeDir + ':' + origPath
})

after(() => {
  process.env.PATH = origPath
  rmSync(fakeDir, { recursive: true, force: true })
})

beforeEach(() => {
  delete process.env.FAKE_MD_RESPONSE
  delete process.env.FAKE_MD_EXIT
})

// fetch.js is imported AFTER PATH is patched so spawnSync picks up fake md
const { fetchUrl } = await import('../fetch.js')

// curl.md markdown table error format
const mkTable = (code, message) =>
  `| Key     | Value${' '.repeat(Math.max(0, message.length - 5))} |\n` +
  `|---------|${'-'.repeat(Math.max(7, message.length + 2))}|\n` +
  `| code    | ${code}${' '.repeat(Math.max(0, message.length - code.length))} |\n` +
  `| message | ${message} |`

// ── 530 unreachable ───────────────────────────────────────────────────────────
describe('530: unreachable origin', () => {
  test('throws an error (not returned as content)', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 530')
    await assert.rejects(() => fetchUrl('yt.com'))
  })

  test('error message contains 530', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 530')
    await assert.rejects(
      () => fetchUrl('yt.com'),
      err => { assert.ok(err.message.includes('530'), err.message); return true }
    )
  })

  test('does NOT throw blocked error for 530', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 530')
    await assert.rejects(
      () => fetchUrl('yt.com'),
      err => { assert.ok(!err.message.includes('blocked'), err.message); return true }
    )
  })

  test('does NOT return raw markdown table as content', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 530')
    let result
    try { result = await fetchUrl('yt.com') } catch {}
    assert.ok(result === undefined, 'should have thrown, not returned content')
  })
})

// ── Blocked detection ─────────────────────────────────────────────────────────
describe('blocked: active anti-scraping responses', () => {
  const blockedCases = [
    ['403 in error table',    mkTable('FETCH_FAILED', 'Upstream returned 403')],
    ['429 in error table',    mkTable('FETCH_FAILED', 'Upstream returned 429')],
    ['Access Denied',         mkTable('FETCH_FAILED', 'Access Denied')],
    ['Forbidden',             mkTable('FETCH_FAILED', 'Forbidden')],
    ['access denied lc',     mkTable('FETCH_FAILED', 'access denied')],
    ['blocked by in table',  mkTable('FETCH_FAILED', 'blocked by firewall')],
    ['403 in page body',     '# Page\n\n403 Forbidden\n\nGet out.'],
    ['Access Denied in body','<h1>Access Denied</h1>'],
  ]

  for (const [label, response] of blockedCases) {
    test(`throws blocked for: ${label}`, async () => {
      process.env.FAKE_MD_RESPONSE = response
      await assert.rejects(
        () => fetchUrl('example.com'),
        err => { assert.ok(err.message.includes('blocked'), `got: ${err.message}`); return true }
      )
    })
  }
})

// ── Other FETCH_FAILED errors ─────────────────────────────────────────────────
describe('other upstream errors', () => {
  test('404 throws with message containing 404', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 404')
    await assert.rejects(
      () => fetchUrl('example.com/gone'),
      err => { assert.ok(err.message.includes('404'), err.message); return true }
    )
  })

  test('502 throws with message containing 502', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 502')
    await assert.rejects(
      () => fetchUrl('example.com'),
      err => { assert.ok(err.message.includes('502'), err.message); return true }
    )
  })

  test('does not leak full markdown table into error message', async () => {
    process.env.FAKE_MD_RESPONSE = mkTable('FETCH_FAILED', 'Upstream returned 503')
    await assert.rejects(
      () => fetchUrl('example.com'),
      err => {
        assert.ok(!err.message.includes('|'), `table leaked into error: ${err.message}`)
        return true
      }
    )
  })
})

// ── Successful fetch ──────────────────────────────────────────────────────────
describe('successful fetch', () => {
  test('returns string content', async () => {
    process.env.FAKE_MD_RESPONSE = '# Hello\n\nThis is markdown content.'
    const result = await fetchUrl('example.com')
    assert.ok(typeof result === 'string')
    assert.ok(result.includes('Hello'))
  })

  test('returns full content unchanged', async () => {
    const content = '# Title\n\nParagraph with **bold** and `code`.\n\n- item 1\n- item 2'
    process.env.FAKE_MD_RESPONSE = content
    const result = await fetchUrl('example.com')
    assert.strictEqual(result, content)
  })

  test('empty response returns empty string', async () => {
    process.env.FAKE_MD_RESPONSE = ''
    const result = await fetchUrl('example.com')
    assert.strictEqual(result, '')
  })
})

// ── URL normalization ─────────────────────────────────────────────────────────
describe('URL normalization', () => {
  test('bare domain resolves without error', async () => {
    process.env.FAKE_MD_RESPONSE = '# page'
    await assert.doesNotReject(() => fetchUrl('example.com'))
  })

  test('https:// URL resolves without error', async () => {
    process.env.FAKE_MD_RESPONSE = '# page'
    await assert.doesNotReject(() => fetchUrl('https://example.com'))
  })

  test('http:// URL resolves without error', async () => {
    process.env.FAKE_MD_RESPONSE = '# page'
    await assert.doesNotReject(() => fetchUrl('http://example.com'))
  })

  test('URL with path resolves without error', async () => {
    process.env.FAKE_MD_RESPONSE = '# docs'
    await assert.doesNotReject(() => fetchUrl('github.com/AbhiShake1/F'))
  })
})

// ── Missing md binary ─────────────────────────────────────────────────────────
describe('missing md binary', () => {
  test('throws missing: when md not in PATH', async () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      await assert.rejects(
        () => fetchUrl('example.com'),
        err => {
          assert.ok(err.message.startsWith('missing:'), `got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })

  test('missing: error mentions curl.md', async () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      await assert.rejects(
        () => fetchUrl('example.com'),
        err => {
          assert.ok(err.message.includes('curl.md'), `got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })

  test('missing: error mentions F -s', async () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      await assert.rejects(
        () => fetchUrl('example.com'),
        err => {
          assert.ok(err.message.includes('F -s'), `got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })
})

// ── HTTPS → HTTP fallback ─────────────────────────────────────────────────────
describe('HTTPS → HTTP fallback', () => {
  test('retries with http:// when https returns a non-block error', async () => {
    // First call (https) returns 530, second call (http) returns content.
    // We simulate this by switching FAKE_MD_RESPONSE between calls using a counter file.
    // Simpler: use a script that checks whether the URL starts with https or http.
    const fakeScript = join(fakeDir, 'md')
    writeFileSync(fakeScript, [
      '#!/bin/sh',
      'case "$1" in',
      '  https://*) printf "%s" "| Key | Value |\\n|-----|-------|\\n| code | FETCH_FAILED |\\n| message | Upstream returned 530 |" ;;',
      '  *) printf "# Fallback worked" ;;',
      'esac',
    ].join('\n'))
    chmodSync(fakeScript, 0o755)

    const result = await fetchUrl('unreachable-on-https.com')
    assert.ok(result.includes('Fallback worked'), `got: ${result}`)

    // Restore generic fake script
    writeFileSync(fakeScript, [
      '#!/bin/sh',
      'printf "%s" "$FAKE_MD_RESPONSE"',
      'exit "${FAKE_MD_EXIT:-0}"',
    ].join('\n'))
    chmodSync(fakeScript, 0o755)
  })

  test('throws blocked (not unreachable) when both https and http are blocked', async () => {
    const fakeScript = join(fakeDir, 'md')
    writeFileSync(fakeScript, [
      '#!/bin/sh',
      'printf "%s" "| Key | Value |\\n|-----|-------|\\n| code | FETCH_FAILED |\\n| message | Forbidden |"',
    ].join('\n'))
    chmodSync(fakeScript, 0o755)

    await assert.rejects(
      () => fetchUrl('blocked-site.com'),
      err => { assert.ok(err.message.includes('blocked'), `got: ${err.message}`); return true }
    )

    writeFileSync(fakeScript, [
      '#!/bin/sh',
      'printf "%s" "$FAKE_MD_RESPONSE"',
      'exit "${FAKE_MD_EXIT:-0}"',
    ].join('\n'))
    chmodSync(fakeScript, 0o755)
  })
})
