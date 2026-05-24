#!/usr/bin/env node
import { detect } from './detect.js'
import { fetchUrl } from './fetch.js'
import { readFile } from './read.js'
import { searchContent } from './search.js'
import { setup } from './setup.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  process.stdout.write('F <file|url|string|...>\n')
  process.exit(0)
}

const arg = args[0]

async function main() {
  try {
    // setup commands
    if (arg === 'setup') {
      const cloak = args[1] === 'cloak-browser'
      await setup(cloak)
      return
    }

    // Detect and route
    const detected = detect(arg)
    let result

    if (detected.type === 'url') {
      result = await fetchUrl(detected.value)
    } else if (detected.type === 'exact-path' || detected.type === 'fuzzy') {
      result = readFile(detected.value)
    } else {
      // content search
      result = searchContent(detected.value)
    }

    if (result) {
      process.stdout.write(result)
      // Ensure trailing newline
      if (!result.endsWith('\n')) process.stdout.write('\n')
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    if (msg.includes('blocked')) {
      process.stderr.write('blocked. `F setup cloak-browser` to bypass\n')
      process.exit(1)
    }
    if (msg.startsWith('missing:')) {
      process.stderr.write(msg + '\n')
      process.exit(1)
    }
    // General error
    process.stderr.write(msg + '\n')
    process.exit(1)
  }
}

main()
