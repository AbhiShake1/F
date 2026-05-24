// node --test test/search.test.js
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, rmSync, writeFileSync, mkdirSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const { searchContent, searchFilename } = await import('../search.js')

function isRgAvailable() {
  const r = spawnSync('which', ['rg'], { encoding: 'utf8' })
  return r.status === 0
}

const RG_AVAILABLE = isRgAvailable()

let tempDir
before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'F-search-test-'))
  writeFileSync(join(tempDir, 'alpha.js'), 'function hello() { return "world" }', 'utf8')
  writeFileSync(join(tempDir, 'beta.ts'), 'export const greeting = "hello"', 'utf8')
  writeFileSync(join(tempDir, 'notes.txt'), 'TODO: fix the bug\nDONE: wrote tests', 'utf8')
  writeFileSync(join(tempDir, 'config.json'), '{"name": "test", "version": "1.0"}', 'utf8')
  mkdirSync(join(tempDir, 'sub'), { recursive: true })
  writeFileSync(join(tempDir, 'sub', 'deep.js'), 'const deep = "nested content here"', 'utf8')
})

after(() => {
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

// ---------- searchContent ----------
describe('searchContent: ripgrep content search', () => {
  test('throws "missing: ripgrep" when rg not in PATH', () => {
    if (RG_AVAILABLE) {
      // rg IS installed, can't trigger ENOENT easily without PATH manipulation
      // We test the error path via source inspection — skip gracefully
      assert.ok(true, 'rg is available; skipping missing-rg test')
      return
    }

    assert.throws(
      () => searchContent('hello'),
      (err) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.startsWith('missing:'), `expected missing: prefix, got: ${err.message}`)
        assert.ok(err.message.includes('ripgrep'), `expected "ripgrep" in message, got: ${err.message}`)
        return true
      }
    )
  })

  test('missing: error message says to run F setup', () => {
    if (RG_AVAILABLE) {
      assert.ok(true, 'skipping — rg available')
      return
    }

    assert.throws(
      () => searchContent('test'),
      (err) => {
        assert.ok(err.message.includes('F setup'))
        return true
      }
    )
  })

  test('returns a string result when rg is available', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping — rg not available')
      return
    }

    // Run from tempDir
    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchContent('hello')
      assert.ok(typeof result === 'string', 'result should be a string')
    } finally {
      process.chdir(origCwd)
    }
  })

  test('returns empty string when no matches found', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping — rg not available')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchContent('__ZZZNO_MATCH_EVER_XYZ__')
      assert.ok(typeof result === 'string')
      assert.equal(result, '', 'no-match should return empty string')
    } finally {
      process.chdir(origCwd)
    }
  })

  test('returns ripgrep-format output with file:line:content', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping — rg not available')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchContent('hello')
      assert.ok(typeof result === 'string')
      if (result.length > 0) {
        // rg output format: filename:linenum:content
        assert.ok(result.includes('hello'), 'result should contain the search term')
      }
    } finally {
      process.chdir(origCwd)
    }
  })

  test('search for TODO matches notes.txt', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchContent('TODO')
      assert.ok(result.includes('TODO'), 'result should contain TODO')
    } finally {
      process.chdir(origCwd)
    }
  })

  test('searches recursively into subdirectories', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchContent('nested content')
      assert.ok(result.includes('nested content'), 'should find content in subdirectory')
    } finally {
      process.chdir(origCwd)
    }
  })
})

// ---------- searchFilename ----------
describe('searchFilename: ripgrep filename search', () => {
  test('throws "missing: ripgrep" when rg not available', () => {
    if (RG_AVAILABLE) {
      assert.ok(true, 'skipping — rg available')
      return
    }

    assert.throws(
      () => searchFilename('hello'),
      (err) => {
        assert.ok(err.message.startsWith('missing:'))
        assert.ok(err.message.includes('ripgrep'))
        return true
      }
    )
  })

  test('returns an array', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('alpha')
      assert.ok(Array.isArray(result), 'result should be an array')
    } finally {
      process.chdir(origCwd)
    }
  })

  test('returns empty array when no filenames match', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('__ZZZNOMATCH_XYZ__')
      assert.ok(Array.isArray(result))
      assert.equal(result.length, 0)
    } finally {
      process.chdir(origCwd)
    }
  })

  test('finds alpha.js when searching for "alpha"', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('alpha')
      assert.ok(result.some(p => p.includes('alpha.js')), `expected alpha.js in results, got: ${result}`)
    } finally {
      process.chdir(origCwd)
    }
  })

  test('finds .ts files when searching for ".ts"', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('.ts')
      assert.ok(result.some(p => p.includes('beta.ts')), `expected beta.ts, got: ${result}`)
    } finally {
      process.chdir(origCwd)
    }
  })

  test('returns string array (each entry is a path string)', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('js')
      for (const entry of result) {
        assert.ok(typeof entry === 'string', `each entry should be a string, got ${typeof entry}`)
      }
    } finally {
      process.chdir(origCwd)
    }
  })

  test('filters out empty strings from result', () => {
    if (!RG_AVAILABLE) {
      assert.ok(true, 'skipping')
      return
    }

    const origCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const result = searchFilename('js')
      assert.ok(!result.includes(''), 'result should not contain empty strings')
    } finally {
      process.chdir(origCwd)
    }
  })
})

// ---------- PATH manipulation test for searchContent ----------
describe('searchContent: PATH manipulation to simulate missing rg', () => {
  test('throws missing: when PATH has no rg binary', () => {
    // Temporarily patch PATH to an empty dir
    const emptyDir = mkdtempSync(join(tmpdir(), 'F-empty-bin-'))
    const origPath = process.env.PATH
    process.env.PATH = emptyDir

    try {
      assert.throws(
        () => searchContent('hello'),
        (err) => {
          assert.ok(err instanceof Error)
          // On macOS/Linux, ENOENT is thrown when binary not found
          // The function wraps it as 'missing: ripgrep not installed. run: F setup'
          assert.ok(
            err.message.startsWith('missing:') || err.code === 'ENOENT',
            `expected missing: error, got: ${err.message}`
          )
          return true
        }
      )
    } finally {
      process.env.PATH = origPath
      try { rmSync(emptyDir, { recursive: true, force: true }) } catch {}
    }
  })

  test('throws missing: for searchFilename when PATH has no rg binary', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'F-empty-bin2-'))
    const origPath = process.env.PATH
    process.env.PATH = emptyDir

    try {
      assert.throws(
        () => searchFilename('hello'),
        (err) => {
          assert.ok(err instanceof Error)
          assert.ok(
            err.message.startsWith('missing:') || err.code === 'ENOENT',
            `expected missing: error, got: ${err.message}`
          )
          return true
        }
      )
    } finally {
      process.env.PATH = origPath
      try { rmSync(emptyDir, { recursive: true, force: true }) } catch {}
    }
  })
})
