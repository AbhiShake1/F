#!/usr/bin/env node
import { detect } from './detect.js'
import { fetchUrl } from './fetch.js'
import { readFile } from './read.js'
import { searchContent } from './search.js'
import { setup } from './setup.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  process.stdout.write('F <file|url|string>...\n')
  process.exit(0)
}

async function processArg(arg) {
  const detected = detect(arg)
  if (detected.type === 'url') return fetchUrl(detected.value)
  if (detected.type === 'exact-path' || detected.type === 'fuzzy') return readFile(detected.value)
  return searchContent(detected.value)
}

async function main() {
  try {
    if (args[0] === '-s') {
      await setup({ cloak: args[1] === 'cloak-browser' })
      return
    }

    const multi = args.length > 1
    for (const arg of args) {
      const result = await processArg(arg)
      if (!result) continue
      if (multi) process.stdout.write(`\n<source: ${arg}>\n`)
      process.stdout.write(result)
      if (!result.endsWith('\n')) process.stdout.write('\n')
      if (multi) process.stdout.write(`</source>\n`)
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    if (msg.includes('blocked')) {
      process.stderr.write('blocked. `F -s cloak-browser` to bypass\n')
    } else if (msg.startsWith('missing:')) {
      process.stderr.write(msg + '\n')
    } else {
      const short = msg.replace(/upstream returned\s*/i, '').trim().toLowerCase()
      process.stderr.write(short + '\n')
    }
    process.exit(1)
  }
}

main()
