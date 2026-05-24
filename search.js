import { spawnSync } from 'child_process'

/**
 * searchContent(query) → string — ripgrep content search in cwd
 */
export function searchContent(query) {
  const result = spawnSync('rg', ['--color=never', query, '.'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  })

  if (result.error && result.error.code === 'ENOENT') {
    throw new Error('missing: ripgrep not installed. run: F setup')
  }

  // rg exits 1 when no matches — that's fine, return empty
  return result.stdout || ''
}

/**
 * searchFilename(name) → string[] — ripgrep filename search
 */
export function searchFilename(name) {
  const result = spawnSync('rg', ['--files', '--glob', `*${name}*`, '.'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  })

  if (result.error && result.error.code === 'ENOENT') {
    throw new Error('missing: ripgrep not installed. run: F setup')
  }

  if (!result.stdout) return []
  return result.stdout.trim().split('\n').filter(Boolean)
}
