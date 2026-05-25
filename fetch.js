import { spawnSync } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// curl.md returns errors as a markdown table: | code | FETCH_FAILED | / | message | ... |
function parseCurlMdError(output) {
  if (!output.includes('FETCH_FAILED') && !output.includes('| code')) return null
  const msg = output.match(/\|\s*message\s*\|\s*([^|]+)\|/)
  return msg ? msg[1].trim() : 'fetch failed'
}

// Hard HTTP errors and soft bot-challenge page signals
const BLOCK_SIGNALS = [
  // HTTP status codes in curl.md error tables
  '403', '429',
  // Standard HTTP denial phrases
  'Access Denied', 'access denied', 'Forbidden', 'blocked by',
  // Distil Networks / Imperva bot challenge (HTTP 200 soft block)
  'Pardon Our Interruption', 'pardon our interruption',
  'your browser made us think you were a bot',
  'we think you were a bot',
  // Cloudflare JS/CAPTCHA challenges (HTTP 200 soft block)
  'Enable JavaScript and cookies to continue',
  'Verifying you are human',
  'Just a moment',
  'Please enable Cookies and reload the page',
  // DataDome
  'dd_referrer',
]

function isBlocked(output) {
  return BLOCK_SIGNALS.some(s => output.includes(s))
}

function runMd(url) {
  const result = spawnSync('md', [url], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.error) {
    if (result.error.code === 'ENOENT') throw new Error('missing: curl.md not installed. run: F -s')
    throw result.error
  }
  const stdout = result.stdout || ''
  const curlErr = parseCurlMdError(stdout)
  if (curlErr) {
    if (isBlocked(curlErr) || isBlocked(stdout)) throw new Error('blocked')
    throw new Error(curlErr)
  }
  return { stdout, status: result.status }
}

function isCloakAvailable() {
  const fDir = join(homedir(), '.F')
  return (
    existsSync(join(fDir, 'src', 'cloak_fetch.js')) &&
    existsSync(join(fDir, 'node_modules', 'cloakbrowser'))
  )
}

function fetchWithCloak(url) {
  const fDir = join(homedir(), '.F')
  const script = join(fDir, 'src', 'cloak_fetch.js')
  const r = spawnSync('node', [script, url], {
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, cwd: fDir
  })
  if (r.error || r.status !== 0) throw new Error('blocked')
  return r.stdout || ''
}

/**
 * fetchUrl(url) → string
 */
export async function fetchUrl(url) {
  let normalizedUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url
  }

  let result
  try {
    result = runMd(normalizedUrl)
  } catch (err) {
    if (err.message && err.message.startsWith('missing:')) throw err
    if (err.message && err.message.startsWith('unreachable:')) throw err
    if (err.message === 'blocked') {
      if (isCloakAvailable()) return fetchWithCloak(normalizedUrl)
      throw err
    }
    // Connection error on https → retry with http
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      result = runMd(httpUrl)
    } else {
      throw err
    }
  }

  if (isBlocked(result.stdout)) {
    // Try http fallback first
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      try {
        const retryResult = runMd(httpUrl)
        if (!isBlocked(retryResult.stdout)) return retryResult.stdout
      } catch {}
    }
    // Try CloakBrowser if available
    if (isCloakAvailable()) return fetchWithCloak(normalizedUrl)
    throw new Error('blocked')
  }

  return result.stdout
}
