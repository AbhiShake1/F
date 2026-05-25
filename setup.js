import { spawnSync } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'


export async function setup({ cloak = false } = {}) {
  const fDir = join(homedir(), '.F')

  if (cloak) {
    spawnSync('npm', ['install', '--prefix', fDir,
      'playwright-extra', 'puppeteer-extra-plugin-stealth', 'turndown'
    ], { stdio: 'pipe' })
    const playwrightBin = join(fDir, 'node_modules', '.bin', 'playwright')
    spawnSync('node', [playwrightBin, 'install', 'chromium'], { stdio: 'inherit' })
    return
  }

  // Core: silent installs
  for (const [cmd, args] of [
    ['npm', ['install', '-g', 'curl.md']],
    ['brew', ['install', 'rtk']],
    ['brew', ['install', 'ripgrep']],
    ['brew', ['install', 'pandoc']],
    ['npm', ['install', '--prefix', fDir, '@pspdfkit/pdf-to-markdown']],
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
