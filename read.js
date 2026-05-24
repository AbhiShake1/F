import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { update } from './frecency.js'

const DOC_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx', '.epub', '.odt', '.html', '.htm'])
const PDF_BIN = path.join(os.homedir(), '.F', 'node_modules', '.bin', 'pdf-to-markdown')

function isRtkAvailable() {
  return spawnSync('which', ['rtk'], { encoding: 'utf8' }).status === 0
}

function readPdf(absPath) {
  // Primary: pdf-to-markdown (fast native binary, installed via F -s)
  if (fs.existsSync(PDF_BIN)) {
    const tmpOut = path.join(os.tmpdir(), `F_pdf_${Date.now()}.md`)
    try {
      const r = spawnSync(PDF_BIN, [absPath, tmpOut], { encoding: 'utf8' })
      if (r.status === 0 && fs.existsSync(tmpOut)) {
        const content = fs.readFileSync(tmpOut, 'utf8')
        fs.unlinkSync(tmpOut)
        return content
      }
    } finally {
      try { fs.unlinkSync(tmpOut) } catch {}
    }
  }

  // Fallback: docling
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
  } else if (DOC_EXTENSIONS.has(ext)) {
    const r = spawnSync('docling', [absPath, '--to', 'markdown'], {
      encoding: 'utf8', maxBuffer: 10 * 1024 * 1024
    })
    if (r.error && r.error.code === 'ENOENT') {
      throw new Error('missing: docling not installed. run: F -s docling')
    }
    if (r.error) throw r.error
    content = r.stdout || ''
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
