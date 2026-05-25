import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { update } from './frecency.js'

const _require = createRequire(import.meta.url)

const PANDOC_TYPES = new Set(['.docx', '.pptx', '.epub', '.odt', '.html', '.htm', '.rtf'])
const SPREADSHEET_TYPES = new Set(['.xlsx', '.xls', '.ods'])

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
  throw new Error('missing: pdf-to-markdown not installed. run: F -s')
}

function readSpreadsheet(absPath) {
  let XLSX
  try { XLSX = _require(path.join(os.homedir(), '.F', 'node_modules', 'xlsx')) } catch {}
  if (!XLSX) { try { XLSX = _require('xlsx') } catch {} }
  if (!XLSX) throw new Error('missing: xlsx not installed. run: F -s')
  const wb = XLSX.readFile(absPath)
  return wb.SheetNames.map(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
    if (!rows.length) return `# Sheet: ${name}\n\n(empty)`
    const widths = rows[0].map((_, ci) => Math.max(...rows.map(r => String(r[ci] ?? '').length), 3))
    const fmt = row => '| ' + widths.map((w, i) => String(row[i] ?? '').padEnd(w)).join(' | ') + ' |'
    const sep = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |'
    return `# Sheet: ${name}\n\n` + [fmt(rows[0]), sep, ...rows.slice(1).map(fmt)].join('\n')
  }).join('\n\n')
}

function readNotebook(absPath) {
  const nb = JSON.parse(fs.readFileSync(absPath, 'utf8'))
  const lang = nb.metadata?.kernelspec?.language || nb.metadata?.language_info?.name || 'python'
  return (nb.cells || []).map(cell => {
    const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source
    if (cell.cell_type === 'markdown') return src
    if (cell.cell_type === 'code') return `\`\`\`${lang}\n${src}\n\`\`\``
    return src
  }).join('\n\n')
}

function readWithPandoc(absPath) {
  const bin = findBin('pandoc')
  if (!bin) throw new Error('missing: pandoc not installed. run: F -s')
  const r = spawnSync(bin, [absPath, '-t', 'markdown', '--wrap=none'], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024
  })
  if (r.error) throw new Error('missing: pandoc not installed. run: F -s')
  if (r.status !== 0) throw new Error('pandoc failed')
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
  } else if (SPREADSHEET_TYPES.has(ext)) {
    content = readSpreadsheet(absPath)
  } else if (ext === '.ipynb') {
    content = readNotebook(absPath)
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
