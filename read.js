import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { update } from './frecency.js'

const _require = createRequire(import.meta.url)

const PANDOC_TYPES = new Set(['.docx', '.pptx', '.epub', '.odt', '.html', '.htm', '.rtf'])
const SPREADSHEET_TYPES = new Set(['.xlsx', '.xls', '.ods'])
const SQLITE_TYPES = new Set(['.sqlite', '.db', '.sqlite3'])

function isTarArchive(absPath) {
  const b = path.basename(absPath).toLowerCase()
  return b.endsWith('.tar') || b.endsWith('.tar.gz') || b.endsWith('.tar.bz2') ||
    b.endsWith('.tar.xz') || b.endsWith('.tgz') || b.endsWith('.tbz2') || b.endsWith('.txz')
}

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

function readArchive(absPath) {
  const base = path.basename(absPath)
  const isZip = absPath.toLowerCase().endsWith('.zip')
  let r
  if (isZip) {
    r = spawnSync('unzip', ['-l', absPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    if (r.status !== 0) throw new Error('unzip failed: ' + (r.stderr || ''))
    const lines = r.stdout.split('\n')
    const dataLines = lines.slice(3, -3).filter(l => l.trim())
    const rows = dataLines.map(l => {
      const m = l.match(/^\s*(\d+)\s+[\d-]+\s[\d:]+\s+(.+)$/)
      return m ? { name: m[2].trim(), size: Number(m[1]) } : null
    }).filter(Boolean)
    const header = `## Archive: ${base} (${rows.length} files)\n\n`
    const tbl = ['| Name | Size |', '|------|------|',
      ...rows.map(r => `| ${r.name} | ${fmtSize(r.size)} |`)].join('\n')
    return header + tbl
  } else {
    r = spawnSync('tar', ['-tvf', absPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    if (r.status !== 0) throw new Error('tar failed: ' + (r.stderr || ''))
    const rows = r.stdout.split('\n').filter(l => l.trim()).map(l => {
      const parts = l.split(/\s+/)
      // format: perms links owner group size date time name
      const size = parseInt(parts[4]) || 0
      const name = parts.slice(8).join(' ')
      return name ? { name, size } : null
    }).filter(Boolean)
    const header = `## Archive: ${base} (${rows.length} entries)\n\n`
    const tbl = ['| Name | Size |', '|------|------|',
      ...rows.map(r => `| ${r.name} | ${fmtSize(r.size)} |`)].join('\n')
    return header + tbl
  }
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function readSqlite(absPath) {
  const run = (args) => spawnSync('sqlite3', args, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 })

  const tablesR = run([absPath, '.tables'])
  if (tablesR.status !== 0) throw new Error('sqlite3 failed: ' + (tablesR.stderr || ''))
  const tables = tablesR.stdout.trim().split(/\s+/).filter(Boolean)
  if (!tables.length) return '(empty database)'

  return tables.map(table => {
    const schemaR = run([absPath, `.schema "${table}"`])
    const schema = schemaR.stdout.trim()

    const colsR = run([absPath, `PRAGMA table_info("${table}");`])
    const cols = colsR.stdout.trim().split('\n').filter(Boolean).map(l => l.split('|')[1])

    const rowsR = run([absPath, '-separator', '|', `SELECT * FROM "${table}" LIMIT 5;`])
    const rawRows = rowsR.stdout.trim().split('\n').filter(Boolean).map(l => l.split('|'))

    let tbl = ''
    if (cols.length && rawRows.length) {
      const sep = '|' + cols.map(() => '---').join('|') + '|'
      tbl = '\n\n' + ['|' + cols.join('|') + '|', sep,
        ...rawRows.map(r => '|' + r.join('|') + '|')].join('\n')
    } else if (!rawRows.length) {
      tbl = '\n\n(empty table)'
    }

    return `## ${table}\n\n\`\`\`sql\n${schema}\n\`\`\`` + tbl
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
  } else if (ext === '.zip' || isTarArchive(absPath)) {
    content = readArchive(absPath)
  } else if (SQLITE_TYPES.has(ext)) {
    content = readSqlite(absPath)
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
