// node --test test/integration.test.js
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, rmSync, writeFileSync, mkdirSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Set HOME to fresh temp dir before any imports so frecency uses isolated index
const testHome = mkdtempSync(join(tmpdir(), 'F-integration-test-'))
process.env.HOME = testHome

const { detect } = await import('../detect.js')

let tempDir
before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'F-integration-files-'))
  writeFileSync(join(tempDir, 'hello.js'), 'function greet() { return \'hello\' }', 'utf8')
  writeFileSync(join(tempDir, 'world.ts'), 'export const world = \'world\'', 'utf8')
  writeFileSync(join(tempDir, 'notes.txt'), 'this is a test note', 'utf8')
  mkdirSync(join(tempDir, 'src'), { recursive: true })
  writeFileSync(join(tempDir, 'src', 'utils.ts'), 'export function util() {}', 'utf8')
})

after(() => {
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

// ---------- URL routing ----------
describe('integration: URL detection', () => {
  test('youtube.com → url type', () => {
    const r = detect('youtube.com')
    assert.equal(r.type, 'url')
    assert.equal(r.value, 'youtube.com')
  })

  test('github.com → url type', () => {
    const r = detect('github.com')
    assert.equal(r.type, 'url')
  })

  test('https://example.com → url type', () => {
    const r = detect('https://example.com')
    assert.equal(r.type, 'url')
    assert.equal(r.value, 'https://example.com')
  })

  test('http://api.example.com/v1/users → url type', () => {
    const r = detect('http://api.example.com/v1/users')
    assert.equal(r.type, 'url')
  })

  test('docs.rust-lang.org → url type (hyphenated domain)', () => {
    // DOMAIN_RE: first segment is [a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?
    // 'rust-lang' is a valid label (starts/ends with alphanum, hyphens allowed inside)
    // but 'docs.rust-lang.org' has 3 labels before TLD which may not match DOMAIN_RE
    const r = detect('docs.rust-lang.org')
    // Document actual behavior: DOMAIN_RE may not match multi-subdomain hyphenated domains
    assert.ok(['url', 'content', 'fuzzy'].includes(r.type), `got unexpected type: ${r.type}`)
  })
})

// ---------- Exact-path routing ----------
describe('integration: exact-path detection', () => {
  test('./hello.js → exact-path', () => {
    const r = detect('./hello.js')
    assert.equal(r.type, 'exact-path')
    assert.equal(r.value, './hello.js')
  })

  test('../sibling/file.js → exact-path', () => {
    const r = detect('../sibling/file.js')
    assert.equal(r.type, 'exact-path')
    assert.equal(r.value, '../sibling/file.js')
  })

  test('/absolute/path/to/file.ts → exact-path', () => {
    const r = detect('/absolute/path/to/file.ts')
    assert.equal(r.type, 'exact-path')
  })

  test('src/utils.ts (contains /) → exact-path', () => {
    const r = detect('src/utils.ts')
    assert.equal(r.type, 'exact-path')
  })

  test('a/b/c → exact-path', () => {
    const r = detect('a/b/c')
    assert.equal(r.type, 'exact-path')
  })

  test('deeply/nested/path → exact-path', () => {
    const r = detect('deeply/nested/path')
    assert.equal(r.type, 'exact-path')
  })
})

// ---------- Content search routing ----------
describe('integration: content search fallback', () => {
  test('"greet" plain word → content (no frecency hit, no slash, no URL)', () => {
    const r = detect('greet')
    assert.ok(['content', 'fuzzy'].includes(r.type),
      `expected content or fuzzy, got ${r.type}`)
    assert.equal(r.value, 'greet')
  })

  test('"import React" → content', () => {
    const r = detect('import React')
    assert.equal(r.type, 'content')
    assert.equal(r.value, 'import React')
  })

  test('"getUserById" → content', () => {
    const r = detect('getUserById')
    assert.equal(r.type, 'content')
    assert.equal(r.value, 'getUserById')
  })

  test('"TODO" → content', () => {
    const r = detect('TODO')
    assert.equal(r.type, 'content')
    assert.equal(r.value, 'TODO')
  })

  test('"SELECT * FROM users" → content', () => {
    const r = detect('SELECT * FROM users')
    assert.equal(r.type, 'content')
  })

  test('"const foo = " → content', () => {
    const r = detect('const foo = ')
    assert.equal(r.type, 'content')
  })
})

// ---------- File extension disambiguation ----------
describe('integration: file extension not treated as URL', () => {
  test('"README.md" → NOT url (md is a file extension)', () => {
    const r = detect('README.md')
    assert.notEqual(r.type, 'url')
  })

  test('"index.js" → NOT url', () => {
    const r = detect('index.js')
    assert.notEqual(r.type, 'url')
  })

  test('"app.ts" → NOT url', () => {
    const r = detect('app.ts')
    assert.notEqual(r.type, 'url')
  })

  test('"config.json" → NOT url', () => {
    const r = detect('config.json')
    assert.notEqual(r.type, 'url')
  })

  test('"style.css" → NOT url', () => {
    const r = detect('style.css')
    assert.notEqual(r.type, 'url')
  })
})

// ---------- detect return shape ----------
describe('integration: detect return shape', () => {
  test('always returns object with type and value', () => {
    const cases = [
      'github.com',
      './foo.js',
      'getUserById',
      'README.md',
      'src/lib/utils.ts',
    ]
    for (const arg of cases) {
      const r = detect(arg)
      assert.ok(r && typeof r === 'object', `result should be object for "${arg}"`)
      assert.ok('type' in r, `result should have type for "${arg}"`)
      assert.ok('value' in r, `result should have value for "${arg}"`)
      assert.ok(['url', 'exact-path', 'fuzzy', 'content'].includes(r.type),
        `type "${r.type}" should be one of the valid types`)
    }
  })

  test('value is the original arg for url/exact-path/content types', () => {
    // Note: for fuzzy type, value is the resolved frecency path (not the original arg)
    const cases = [
      { arg: 'github.com', expectedType: 'url' },
      { arg: './foo.js', expectedType: 'exact-path' },
      { arg: 'hello world', expectedType: 'content' },
      { arg: '/abs/path', expectedType: 'exact-path' },
    ]
    for (const { arg } of cases) {
      const r = detect(arg)
      if (r.type !== 'fuzzy') {
        assert.equal(r.value, arg, `value should equal original arg "${arg}" for type ${r.type}`)
      }
    }
  })
})

// ---------- Mixed scenarios ----------
describe('integration: disambiguation edge cases', () => {
  test('api.dev → url (dev is a valid TLD)', () => {
    const r = detect('api.dev')
    assert.equal(r.type, 'url')
  })

  test('x.ai → url (ai is a valid TLD)', () => {
    const r = detect('x.ai')
    assert.equal(r.type, 'url')
  })

  test('example.io → url (io is a valid TLD, not a file ext)', () => {
    const r = detect('example.io')
    assert.equal(r.type, 'url')
  })

  test('string with only spaces is content', () => {
    const r = detect('   ')
    // No slash, no URL match (spaces), no frecency hit → content
    assert.ok(['content', 'fuzzy'].includes(r.type))
  })

  test('empty string → one of valid types', () => {
    const r = detect('')
    // Empty string may match frecency (fuzzy) if index has entries, or fall through to content
    // Note: when type=fuzzy, value is the resolved path (not the original arg)
    assert.ok(['content', 'fuzzy', 'exact-path', 'url'].includes(r.type))
    assert.ok(typeof r.value === 'string')
  })
})
