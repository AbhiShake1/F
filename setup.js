import { spawnSync } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export async function setup(installCloak = false) {
  const fDir = join(homedir(), '.F')

  if (installCloak) {
    // Install npm packages locally to ~/.F/ so cloak_fetch.js can resolve them
    spawnSync('npm', ['install', '--prefix', fDir,
      'playwright-extra', 'puppeteer-extra-plugin-stealth', 'turndown'
    ], { stdio: 'pipe' })
    // Download stealth Chromium binary — large, show progress
    const playwrightBin = join(fDir, 'node_modules', '.bin', 'playwright')
    spawnSync('node', [playwrightBin, 'install', 'chromium'], { stdio: 'inherit' })
    return
  }

  // Silent installs — suppress output to keep AI context clean
  for (const [cmd, args] of [
    ['npm', ['install', '-g', 'curl.md']],
    ['brew', ['install', 'rtk']],
    ['brew', ['install', 'ripgrep']],
    ['pip', ['install', 'docling']],
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
