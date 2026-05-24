import { spawnSync } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

function pip(args, opts = {}) {
  // try pip3 first, fall back to pip
  for (const cmd of ['pip3', 'pip']) {
    const r = spawnSync(cmd, args, { ...opts, encoding: 'utf8' })
    if (!r.error) return r
  }
}

export async function setup({ cloak = false, docling = false } = {}) {
  const fDir = join(homedir(), '.F')

  if (cloak) {
    spawnSync('npm', ['install', '--prefix', fDir,
      'playwright-extra', 'puppeteer-extra-plugin-stealth', 'turndown'
    ], { stdio: 'pipe' })
    const playwrightBin = join(fDir, 'node_modules', '.bin', 'playwright')
    spawnSync('node', [playwrightBin, 'install', 'chromium'], { stdio: 'inherit' })
    return
  }

  if (docling) {
    pip(['install', 'docling'], { stdio: 'inherit' })
    return
  }

  // Core: silent installs
  for (const [cmd, args] of [
    ['npm', ['install', '-g', 'curl.md']],
    ['brew', ['install', 'rtk']],
    ['brew', ['install', 'ripgrep']],
  ]) {
    spawnSync(cmd, args, { stdio: 'pipe' })
  }
}

export function isCloakAvailable() {
  const fDir = join(homedir(), '.F')
  return (
    existsSync(join(fDir, 'src', 'cloak_fetch.js')) &&
    existsSync(join(fDir, 'node_modules', 'playwright-extra'))
  )
}
