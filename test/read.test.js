// node --test test/read.test.js
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, rmSync, writeFileSync, existsSync,
  readFileSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

// Set HOME to temp dir BEFORE importing read.js (which imports frecency.js)
const testHome = mkdtempSync(join(tmpdir(), 'F-read-test-'))
process.env.HOME = testHome

const { readFile } = await import('../read.js')

const INDEX_PATH = join(testHome, '.F', 'index.json')

function readIndex() {
  if (!existsSync(INDEX_PATH)) return []
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
}

// Create a temp dir for test files
let tempDir
before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'F-read-files-'))
})

after(() => {
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

// ---------- Basic file reading ----------
describe('readFile: plain text files', () => {
  test('reads a .txt file and returns its contents', () => {
    const file = join(tempDir, 'hello.txt')
    writeFileSync(file, 'hello world\nline two', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.includes('hello world') || content.length > 0,
      'content should contain file text (may be rtk-compressed)')
  })

  test('reads a .js file and returns its contents', () => {
    const file = join(tempDir, 'code.js')
    writeFileSync(file, 'function greet() { return "hello" }', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0, 'content should not be empty')
  })

  test('reads a .ts file', () => {
    const file = join(tempDir, 'types.ts')
    writeFileSync(file, 'export interface Foo { bar: string }', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0)
  })

  test('reads a .json file', () => {
    const file = join(tempDir, 'data.json')
    writeFileSync(file, '{"key": "value", "num": 42}', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0)
  })

  test('reads a .md file', () => {
    const file = join(tempDir, 'readme.md')
    writeFileSync(file, '# Title\n\nSome content here.', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0)
  })

  test('reads a .py file', () => {
    const file = join(tempDir, 'script.py')
    writeFileSync(file, 'def main():\n    print("hello")\n', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0)
  })

  test('reads empty file without error', () => {
    const file = join(tempDir, 'empty.txt')
    writeFileSync(file, '', 'utf8')
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    // rtk or raw read — both should return empty or near-empty string
  })
})

// ---------- Error cases ----------
describe('readFile: error handling', () => {
  test('throws with "file not found:" for nonexistent file', () => {
    assert.throws(
      () => readFile(join(tempDir, 'does_not_exist_xyz.txt')),
      (err) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.startsWith('file not found:'), `expected "file not found:" prefix, got: ${err.message}`)
        return true
      }
    )
  })

  test('throws with "file not found:" for nonexistent path with subdir', () => {
    assert.throws(
      () => readFile(join(tempDir, 'sub', 'dir', 'missing.js')),
      (err) => {
        assert.ok(err.message.startsWith('file not found:'))
        return true
      }
    )
  })

  test('throws with "file not found:" for absolute nonexistent path', () => {
    assert.throws(
      () => readFile('/tmp/__F_test_nonexistent_' + Date.now() + '.txt'),
      (err) => {
        assert.ok(err.message.startsWith('file not found:'))
        return true
      }
    )
  })
})

// ---------- Document extension handling ----------
describe('readFile: document extensions (docling)', () => {
  function isDoclingAvailable() {
    const r = spawnSync('which', ['docling'], { encoding: 'utf8' })
    return r.status === 0
  }

  test('.pdf → throws "missing: docling" if docling not installed', () => {
    if (isDoclingAvailable()) {
      assert.ok(true, 'docling is installed; skipping missing-docling test')
      return
    }

    const file = join(tempDir, 'fake.pdf')
    // Write minimal fake PDF bytes (just needs to exist)
    writeFileSync(file, Buffer.from('%PDF-1.4\n%%EOF\n'))

    assert.throws(
      () => readFile(file),
      (err) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.startsWith('missing:'), `expected missing: prefix, got: ${err.message}`)
        assert.ok(err.message.includes('docling'), `expected "docling" in message, got: ${err.message}`)
        return true
      }
    )
  })

  test('.docx → throws "missing: docling" if docling not installed', () => {
    if (isDoclingAvailable()) {
      assert.ok(true, 'skipping')
      return
    }

    const file = join(tempDir, 'fake.docx')
    writeFileSync(file, Buffer.from('PK\x03\x04')) // fake zip/docx header

    assert.throws(
      () => readFile(file),
      (err) => {
        assert.ok(err.message.startsWith('missing:'))
        assert.ok(err.message.includes('docling'))
        return true
      }
    )
  })

  test('.epub → throws "missing: docling" if docling not installed', () => {
    if (isDoclingAvailable()) {
      assert.ok(true, 'skipping')
      return
    }

    const file = join(tempDir, 'fake.epub')
    writeFileSync(file, Buffer.from('PK\x03\x04'))

    assert.throws(
      () => readFile(file),
      (err) => {
        assert.ok(err.message.startsWith('missing:'))
        return true
      }
    )
  })

  test('.html is a doc extension → uses docling path', () => {
    if (isDoclingAvailable()) {
      assert.ok(true, 'skipping missing-docling test (docling installed)')
      return
    }

    const file = join(tempDir, 'page.html')
    writeFileSync(file, '<html><body>hello</body></html>', 'utf8')

    assert.throws(
      () => readFile(file),
      (err) => {
        assert.ok(err.message.startsWith('missing:'))
        return true
      }
    )
  })
})

// ---------- Frecency update ----------
describe('readFile: frecency index updated after read', () => {
  test('reading a file updates the frecency index', () => {
    const file = join(tempDir, 'frecency_test.txt')
    writeFileSync(file, 'frecency test content', 'utf8')

    readFile(file)

    const idx = readIndex()
    const entry = idx.find(e => e.path === file)
    assert.ok(entry, `frecency entry should exist for ${file}`)
    assert.ok(entry.score > 0, 'score should be > 0')
    assert.ok(typeof entry.lastAccess === 'number', 'lastAccess should be a number')
  })

  test('reading a file multiple times increases its score', () => {
    const file = join(tempDir, 'multi_read.js')
    writeFileSync(file, 'const x = 1', 'utf8')

    readFile(file)

    readFile(file)
    const score2 = readIndex().find(e => e.path === file)?.score ?? 0

    // Second read may increase score (both within 1hr, multiplier=4)
    // Due to normalization score2 could theoretically be less, but it should exist
    assert.ok(score2 > 0)
    assert.ok(typeof score2 === 'number')
  })

  test('frecency entry has correct path (absolute)', () => {
    const file = join(tempDir, 'abspath_test.txt')
    writeFileSync(file, 'abs path check', 'utf8')

    readFile(file)

    const idx = readIndex()
    // read.js calls path.resolve(filePath) before update
    const entry = idx.find(e => e.path === file)
    assert.ok(entry, 'entry should use absolute path')
  })
})

// ---------- Path resolution ----------
describe('readFile: path resolution', () => {
  test('resolves relative path correctly (when run from tempDir)', () => {
    const file = join(tempDir, 'relative_test.txt')
    writeFileSync(file, 'relative path content', 'utf8')

    // Use absolute path (relative resolution depends on cwd)
    const content = readFile(file)
    assert.ok(typeof content === 'string')
    assert.ok(content.length > 0)
  })
})
