import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'

const INDEX_DIR = path.join(os.homedir(), '.F')
const INDEX_PATH = path.join(INDEX_DIR, 'index.json')
const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000

/** @type {{ path: string, score: number, lastAccess: number }[] | null} */
let _index = null

function loadIndex() {
  if (_index !== null) return _index
  try {
    if (!fs.existsSync(INDEX_DIR)) fs.mkdirSync(INDEX_DIR, { recursive: true })
    if (!fs.existsSync(INDEX_PATH)) {
      _index = []
      return _index
    }
    _index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
  } catch {
    _index = []
  }
  return _index
}

function saveIndex() {
  try {
    fs.mkdirSync(INDEX_DIR, { recursive: true })
    fs.writeFileSync(INDEX_PATH, JSON.stringify(_index), 'utf8')
  } catch {
    // best effort
  }
}

function normalize() {
  const now = Date.now()
  // Remove stale entries: score < 1 AND file gone AND old access
  _index = _index.filter(e => {
    if (e.score < 1) return false
    if (!fs.existsSync(e.path) && now - e.lastAccess > NINETY_DAYS_MS) return false
    return true
  })
  // Normalize scores
  const sum = _index.reduce((s, e) => s + e.score, 0)
  if (sum > 1000) {
    const factor = sum / 900
    for (const e of _index) e.score /= factor
  }
}

/**
 * update(filePath) → void — update frecency score for a path
 */
export function update(filePath) {
  loadIndex()
  const now = Date.now()
  let entry = _index.find(e => e.path === filePath)
  if (!entry) {
    entry = { path: filePath, score: 0, lastAccess: now }
    _index.push(entry)
  }
  const age = now - entry.lastAccess
  let multiplier = 0.25
  if (age < 3600000) multiplier = 4
  else if (age < 86400000) multiplier = 2
  else if (age < 604800000) multiplier = 0.5

  entry.score = (entry.score + 1) * multiplier
  entry.lastAccess = now
  normalize()
  saveIndex()
}

/**
 * bulkInsert(paths) → void — insert paths with score=1 if not already indexed
 */
export function bulkInsert(paths) {
  loadIndex()
  const now = Date.now()
  const existing = new Set(_index.map(e => e.path))
  let changed = false
  for (const p of paths) {
    if (!existing.has(p)) {
      _index.push({ path: p, score: 1, lastAccess: now })
      existing.add(p)
      changed = true
    }
  }
  if (changed) saveIndex()
}

/**
 * matchesQuery(filePath, query) → boolean
 */
function matchesQuery(filePath, query) {
  const base = path.basename(filePath)
  const q = query.toLowerCase()
  if (base === query) return true
  if (base.toLowerCase().startsWith(q)) return true
  if (filePath.includes(query)) return true
  return false
}

/**
 * bestMatch(query) → string|null — find highest-score match in current index
 */
function bestMatch(query) {
  const candidates = _index.filter(e => matchesQuery(e.path, query))
  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].path
}

/**
 * lookup(query) → string|null
 */
export function lookup(query) {
  loadIndex()

  // 1. Try frecency index first
  const hit = bestMatch(query)
  if (hit) return hit

  // 2. Try git ls-files in cwd
  try {
    const gitResult = spawnSync('git', ['ls-files'], { cwd: process.cwd(), encoding: 'utf8' })
    if (gitResult.status === 0 && gitResult.stdout) {
      const gitPaths = gitResult.stdout.trim().split('\n')
        .filter(Boolean)
        .map(p => path.resolve(process.cwd(), p))
      bulkInsert(gitPaths)
      const gitHit = bestMatch(query)
      if (gitHit) return gitHit
    }
  } catch {
    // suppress
  }

  // 3. Try rg --files in cwd
  try {
    const rgResult = spawnSync('rg', ['--files', '.'], { cwd: process.cwd(), encoding: 'utf8' })
    if (rgResult.status === 0 && rgResult.stdout) {
      const rgPaths = rgResult.stdout.trim().split('\n')
        .filter(Boolean)
        .map(p => path.resolve(process.cwd(), p))
      bulkInsert(rgPaths)
      const rgHit = bestMatch(query)
      if (rgHit) return rgHit
    }
  } catch {
    // suppress
  }

  return null
}
