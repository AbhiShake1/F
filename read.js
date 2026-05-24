import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { update } from './frecency.js'

const DOC_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx', '.epub', '.odt', '.html', '.htm'])

function isRtkAvailable() {
  const result = spawnSync('which', ['rtk'], { encoding: 'utf8' })
  return result.status === 0
}

/**
 * readFile(filePath) → string
 */
export function readFile(filePath) {
  const absPath = path.resolve(filePath)

  if (!fs.existsSync(absPath)) {
    throw new Error('file not found: ' + filePath)
  }

  const ext = path.extname(absPath).toLowerCase()

  let content
  if (DOC_EXTENSIONS.has(ext)) {
    // Use docling for document types
    const result = spawnSync('docling', [absPath, '--to', 'markdown'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    })
    if (result.error && result.error.code === 'ENOENT') {
      throw new Error('missing: docling not installed. run: F -s docling')
    }
    if (result.error) throw result.error
    content = result.stdout || ''
  } else {
    // Try rtk read first, fall back to raw fs read
    if (isRtkAvailable()) {
      const result = spawnSync('rtk', ['read', absPath], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })
      if (result.status === 0 && result.stdout) {
        content = result.stdout
      } else {
        content = fs.readFileSync(absPath, 'utf8')
      }
    } else {
      content = fs.readFileSync(absPath, 'utf8')
    }
  }

  // Update frecency
  update(absPath)

  return content
}
