// node --test test/detect.test.js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We need frecency.lookup to return null for content fallback tests.
// Set HOME to a fresh temp dir so the frecency index is empty.
const testHome = mkdtempSync(join(tmpdir(), 'F-detect-test-'))
process.env.HOME = testHome

const { detect } = await import('../detect.js')

// ---------- URL cases ----------
describe('detect: URL detection', () => {
  const urlCases = [
    'youtube.com',
    'github.com',
    'https://example.com',
    'http://foo.bar/path?q=1',
    'example.io',
    'api.dev',
    'x.ai',
    'sub.domain.com/path',
    'https://www.google.com',
    'http://localhost:3000',
    'ftp://files.example.com/data',
    'https://example.com/path?q=hello&foo=bar',
    'https://example.com/#hash',
    'docs.example.com',
    'my-site.co.uk',
    'example.org',
    'news.ycombinator.com',
  ]

  for (const arg of urlCases) {
    test(`"${arg}" → url`, () => {
      const result = detect(arg)
      assert.equal(result.type, 'url', `expected url for "${arg}", got ${result.type}`)
      assert.equal(result.value, arg)
    })
  }
})

// ---------- NOT URL: file extension cases ----------
describe('detect: file extensions NOT treated as URL', () => {
  // These look like domain-ish strings but have known file extensions —
  // they should NOT be url; they'll fall through to exact-path (if they have /)
  // or fuzzy/content if they don't.
  const nonUrlFilenames = [
    'README.md',
    'index.js',
    'app.ts',
    'config.json',
    'style.css',
    'data.csv',
    'file.py',
    'script.sh',
    'image.png',
    'photo.jpg',
    'document.pdf',
    'component.tsx',
    'module.mjs',
    'lock.lock',
    'query.graphql',
    'layout.html',
    'vector.svg',
  ]

  for (const arg of nonUrlFilenames) {
    test(`"${arg}" → NOT url`, () => {
      const result = detect(arg)
      assert.notEqual(result.type, 'url', `"${arg}" should not be url but got url`)
    })
  }
})

// ---------- Exact-path cases ----------
describe('detect: exact-path detection', () => {
  const exactPathCases = [
    './src/index.ts',
    '../other/file.js',
    '/absolute/path.json',
    'src/lib/utils.ts',
    'a/b/c',
    './README.md',
    '../sibling/config.yaml',
    '/usr/local/bin/node',
    'foo/bar/baz.js',
    'deeply/nested/path/to/file.ts',
  ]

  for (const arg of exactPathCases) {
    test(`"${arg}" → exact-path`, () => {
      const result = detect(arg)
      assert.equal(result.type, 'exact-path', `expected exact-path for "${arg}", got ${result.type}`)
      assert.equal(result.value, arg)
    })
  }
})

// ---------- Content fallback (no frecency hit, no /, no URL) ----------
describe('detect: content fallback', () => {
  // These are plain strings with no file extension that looks file-like,
  // no slashes, not URLs — should fall through to content
  const contentCases = [
    'getUserById',
    'someRandomString123',
    'TODO',
    'import React',
    'hello world',
    'function greet',
    'const foo',
    'SELECT * FROM',
    'plainword',
    'CamelCaseIdent',
    'snake_case_ident',
    'UPPER_CONSTANT',
  ]

  for (const arg of contentCases) {
    test(`"${arg}" → content`, () => {
      const result = detect(arg)
      assert.equal(result.type, 'content', `expected content for "${arg}", got ${result.type}`)
      assert.equal(result.value, arg)
    })
  }
})

// ---------- Value passthrough ----------
describe('detect: value is always the original arg', () => {
  test('url preserves original value', () => {
    const r = detect('github.com')
    assert.equal(r.value, 'github.com')
  })

  test('exact-path preserves original value', () => {
    const r = detect('./foo/bar.js')
    assert.equal(r.value, './foo/bar.js')
  })

  test('content preserves original value', () => {
    const r = detect('getUserById')
    assert.equal(r.value, 'getUserById')
  })
})

// ---------- Known DOMAIN_RE quirks ----------
describe('detect: DOMAIN_RE quirks (document actual behavior)', () => {
  test('a.b.c.d.com → NOT url (DOMAIN_RE only allows one subdomain label)', () => {
    // The regex ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$
    // requires each label to be exactly one segment — deeply nested doesn't match
    const r = detect('a.b.c.d.com')
    assert.notEqual(r.type, 'url')
  })

  test('archive.zip → url (zip matches as TLD; not in FILE_EXTS)', () => {
    // .zip is NOT in FILE_EXTS, so isFileExtension returns false
    // DOMAIN_RE matches it as a bare domain → url
    const r = detect('archive.zip')
    assert.equal(r.type, 'url')
  })
})

// ---------- Edge cases ----------
describe('detect: edge cases', () => {
  test('explicit https:// overrides file-extension check', () => {
    // A URL with a path ending in .js still has :// → url
    const r = detect('https://cdn.example.com/bundle.js')
    assert.equal(r.type, 'url')
  })

  test('explicit http:// is url regardless of path', () => {
    const r = detect('http://example.com/data.json')
    assert.equal(r.type, 'url')
  })

  test('path starting with / is exact-path even without extension', () => {
    const r = detect('/etc/hosts')
    assert.equal(r.type, 'exact-path')
  })

  test('path starting with ./ is exact-path', () => {
    const r = detect('./noext')
    assert.equal(r.type, 'exact-path')
  })

  test('path starting with ../ is exact-path', () => {
    const r = detect('../noext')
    assert.equal(r.type, 'exact-path')
  })

  test('string with space is not url', () => {
    // DOMAIN_RE requires no spaces
    const r = detect('hello world.com')
    assert.notEqual(r.type, 'url')
  })

  test('single word no extension no slash → content or fuzzy', () => {
    const r = detect('hello')
    assert.ok(['content', 'fuzzy'].includes(r.type))
  })
})

// Cleanup
import { after } from 'node:test'
after(() => {
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
})
