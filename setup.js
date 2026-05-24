import { spawnSync } from 'child_process'

export async function setup(installCloak = false) {
  if (installCloak) {
    // Show full output — large binary, user initiated, progress bars expected
    spawnSync('npm', ['install', '-g', '@cloakhq/cloak-browser'], { stdio: 'inherit' })
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
