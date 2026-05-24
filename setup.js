import { spawnSync } from 'child_process'

/**
 * setup(installCloak?) → void
 * Best-effort install of all dependencies. Ignores individual failures.
 */
export async function setup(installCloak = false) {
  const cmds = [
    ['npm', ['install', '-g', 'curl.md']],
    ['brew', ['install', 'rtk']],
    ['brew', ['install', 'ripgrep']],
    ['pip', ['install', 'docling']],
  ]

  if (installCloak) {
    cmds.push(['npm', ['install', '-g', '@cloakhq/cloak-browser']])
  }

  for (const [cmd, args] of cmds) {
    spawnSync(cmd, args, { stdio: 'pipe' })
    // ignore errors — best effort install
  }

  // print nothing on success
}
