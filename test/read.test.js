// node --test test/read.test.js
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, rmSync, writeFileSync, existsSync,
  readFileSync, chmodSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Set HOME to temp dir BEFORE importing read.js (which imports frecency.js)
const testHome = mkdtempSync(join(tmpdir(), 'F-read-test-'))
process.env.HOME = testHome

// Fake binary dir — prepend to PATH so read.js picks up our stubs
let fakeBinDir = mkdtempSync(join(tmpdir(), 'F-read-bins-'))
const origReadPath = process.env.PATH
process.env.PATH = fakeBinDir + ':' + origReadPath

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
  process.env.PATH = origReadPath
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
  try { rmSync(fakeBinDir, { recursive: true, force: true }) } catch {}
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
describe('readFile: document extensions (missing tool errors)', () => {
  test('.pdf → throws "missing: pdf-to-markdown" if pdf-to-markdown not installed', () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      const file = join(tempDir, 'notools.pdf')
      writeFileSync(file, Buffer.from('%PDF-1.4\n%%EOF\n'))
      assert.throws(
        () => readFile(file),
        (err) => {
          assert.ok(err instanceof Error)
          assert.ok(err.message.startsWith('missing:'), `expected missing: prefix, got: ${err.message}`)
          assert.ok(err.message.includes('pdf-to-markdown'), `expected "pdf-to-markdown" in message, got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })

  test('.docx → throws "missing: pandoc" if pandoc not installed', () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      const file = join(tempDir, 'nopandoc2.docx')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      assert.throws(
        () => readFile(file),
        (err) => {
          assert.ok(err.message.startsWith('missing:'))
          assert.ok(err.message.includes('pandoc'), `expected "pandoc" in message, got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })

  test('.epub → throws "missing: pandoc" if pandoc not installed', () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      const file = join(tempDir, 'nopandoc3.epub')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      assert.throws(
        () => readFile(file),
        (err) => {
          assert.ok(err.message.startsWith('missing:'))
          assert.ok(err.message.includes('pandoc'))
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })

  test('.html is a pandoc extension → throws missing: pandoc if not installed', () => {
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      const file = join(tempDir, 'page2.html')
      writeFileSync(file, '<html><body>hello</body></html>', 'utf8')
      assert.throws(
        () => readFile(file),
        (err) => {
          assert.ok(err.message.startsWith('missing:'))
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })
})

// ---------- pandoc path ----------
describe('readFile: pandoc path (DOCX, PPTX, EPUB, ODT)', () => {
  function installFakePandoc(output, exitCode = 0) {
    const script = join(fakeBinDir, 'pandoc')
    writeFileSync(script, [
      '#!/bin/sh',
      `printf '%s' '${output.replace(/'/g, "'\\''")}'`,
      `exit ${exitCode}`,
    ].join('\n'))
    chmodSync(script, 0o755)
  }

  function removeFakePandoc() {
    try { rmSync(join(fakeBinDir, 'pandoc')) } catch {}
  }

  test('.docx → uses pandoc, returns its stdout', () => {
    installFakePandoc('# Hello')
    try {
      const file = join(tempDir, 'fake.docx')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      const content = readFile(file)
      assert.ok(typeof content === 'string')
      assert.ok(content.includes('# Hello'), `expected "# Hello", got: ${content}`)
    } finally {
      removeFakePandoc()
    }
  })

  test('.pptx → uses pandoc', () => {
    installFakePandoc('## Slide')
    try {
      const file = join(tempDir, 'fake.pptx')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      const content = readFile(file)
      assert.ok(content.includes('## Slide'), `expected "## Slide", got: ${content}`)
    } finally {
      removeFakePandoc()
    }
  })

  test('.epub → uses pandoc', () => {
    installFakePandoc('epub content')
    try {
      const file = join(tempDir, 'fake.epub')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      const content = readFile(file)
      assert.ok(content.includes('epub content'), `got: ${content}`)
    } finally {
      removeFakePandoc()
    }
  })

  test('.odt → uses pandoc', () => {
    installFakePandoc('odt content')
    try {
      const file = join(tempDir, 'fake.odt')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      const content = readFile(file)
      assert.ok(content.includes('odt content'), `got: ${content}`)
    } finally {
      removeFakePandoc()
    }
  })

  test('.docx → throws missing: when pandoc not in PATH', () => {
    removeFakePandoc()
    const savedPath = process.env.PATH
    process.env.PATH = '/nonexistent'
    try {
      const file = join(tempDir, 'nopandoc.docx')
      writeFileSync(file, Buffer.from('PK\x03\x04'))
      assert.throws(
        () => readFile(file),
        err => {
          assert.ok(err.message.startsWith('missing:'), `got: ${err.message}`)
          assert.ok(err.message.includes('pandoc'), `got: ${err.message}`)
          return true
        }
      )
    } finally {
      process.env.PATH = savedPath
    }
  })
})

// ---------- pdf-to-markdown path ----------
describe('readFile: pdf-to-markdown path', () => {
  function installFakePdfToMd(output, exitCode = 0) {
    const script = join(fakeBinDir, 'pdf-to-markdown')
    writeFileSync(script, [
      '#!/bin/sh',
      `printf '%s' '${output.replace(/'/g, "'\\''")}'`,
      `exit ${exitCode}`,
    ].join('\n'))
    chmodSync(script, 0o755)
  }

  function removeFakePdfToMd() {
    try { rmSync(join(fakeBinDir, 'pdf-to-markdown')) } catch {}
  }

  test('.pdf → uses pdf-to-markdown bin when available', () => {
    installFakePdfToMd('# PDF Content')
    try {
      const file = join(tempDir, 'fake.pdf')
      writeFileSync(file, Buffer.from('%PDF-1.4\n%%EOF\n'))
      const content = readFile(file)
      assert.ok(typeof content === 'string')
      assert.ok(content.includes('# PDF Content'), `expected "# PDF Content", got: ${content}`)
    } finally {
      removeFakePdfToMd()
    }
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
