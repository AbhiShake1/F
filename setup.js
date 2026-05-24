import { spawnSync } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'


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
    // pipx handles PEP 668 (Homebrew Python blocks system-wide pip)
    const hasPipx = spawnSync('which', ['pipx'], { encoding: 'utf8' }).status === 0
    if (!hasPipx) spawnSync('brew', ['install', 'pipx'], { stdio: 'inherit' })
    spawnSync('pipx', ['install', 'docling', '--include-deps'], { stdio: 'inherit' })
    return
  }

  // Core: silent installs
  for (const [cmd, args] of [
    ['npm', ['install', '-g', 'curl.md']],
    ['brew', ['install', 'rtk']],
    ['brew', ['install', 'ripgrep']],
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
