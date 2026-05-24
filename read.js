import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { update } from './frecency.js'

// pdf-to-markdown for PDFs, pandoc for everything else
const PANDOC_TYPES = new Set(['.docx', '.pptx', '.epub', '.odt', '.html', '.htm'])

function isRtkAvailable() {
  return spawnSync('which', ['rtk'], { encoding: 'utf8' }).status === 0
}

function findBin(name) {
  const local = path.join(os.homedir(), '.F', 'node_modules', '.bin', name)
  if (fs.existsSync(local)) return local
  const r = spawnSync('which', [name], { encoding: 'utf8' })
  return r.status === 0 ? name : null
}

function readPdf(absPath) {
  const bin = findBin('pdf-to-markdown')
  if (bin) {
    const r = spawnSync(bin, [absPath], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    if (r.status === 0 && r.stdout) return r.stdout
  }
  return readWithDocling(absPath)
}

function readWithPandoc(absPath) {
  const bin = findBin('pandoc')
  if (!bin) throw new Error('missing: pandoc not installed. run: F -s')
  const r = spawnSync(bin, [absPath, '-t', 'markdown', '--wrap=none'], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024
  })
  if (r.error) throw new Error('missing: pandoc not installed. run: F -s')
  if (r.status !== 0) return readWithDocling(absPath)
  return r.stdout || ''
}

function readWithDocling(absPath) {
  const r = spawnSync('docling', [absPath, '--to', 'markdown'], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024
  })
  if (r.error && r.error.code === 'ENOENT') {
    throw new Error('missing: docling not installed. run: F -s docling')
  }
  if (r.error) throw r.error
  return r.stdout || ''
}

export function readFile(filePath) {
  const absPath = path.resolve(filePath)

  if (!fs.existsSync(absPath)) throw new Error('file not found: ' + filePath)

  const ext = path.extname(absPath).toLowerCase()
  let content

  if (ext === '.pdf') {
    content = readPdf(absPath)
  } else if (PANDOC_TYPES.has(ext)) {
    content = readWithPandoc(absPath)
  } else if (ext === '.xlsx') {
    // pandoc doesn't handle xlsx — fall through to docling
    content = readWithDocling(absPath)
  } else {
    if (isRtkAvailable()) {
      const r = spawnSync('rtk', ['read', absPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      content = (r.status === 0 && r.stdout) ? r.stdout : fs.readFileSync(absPath, 'utf8')
    } else {
      content = fs.readFileSync(absPath, 'utf8')
    }
  }

  update(absPath)
  return content
}
