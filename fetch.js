import { spawnSync } from 'child_process'

// curl.md returns a JSON error object on failure: { code, message }
function parseCurlMdError(output) {
  try {
    const j = JSON.parse(output.trim())
    if (j && j.code) return j
  } catch {}
  return null
}

// 4xx/5xx signals that mean the site is actively blocking scrapers
const BLOCK_SIGNALS = ['403', '429', 'Access Denied', 'blocked by', 'Forbidden', 'access denied']

function isBlocked(output) {
  return BLOCK_SIGNALS.some(s => output.includes(s))
}

function runMd(url) {
  const result = spawnSync('md', [url], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('missing: curl.md not installed. run: F -s')
    }
    throw result.error
  }
  const stdout = result.stdout || ''

  // curl.md signals failure via a JSON error object in stdout
  const err = parseCurlMdError(stdout)
  if (err) {
    const msg = err.message || ''
    // 530 = Cloudflare origin DNS error — site unreachable, not blocked
    if (msg.includes('530')) throw new Error('unreachable: ' + url + ' (origin DNS error)')
    // Other upstream errors that indicate active blocking
    if (isBlocked(msg) || isBlocked(stdout)) throw new Error('blocked')
    throw new Error('fetch failed: ' + msg)
  }

  return { stdout, status: result.status }
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
    // Connection error or blocked on https → retry with http
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      result = runMd(httpUrl)
    } else {
      throw err
    }
  }

  if (isBlocked(result.stdout)) {
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      let retryResult
      try {
        retryResult = runMd(httpUrl)
      } catch {
        throw new Error('blocked')
      }
      if (isBlocked(retryResult.stdout)) throw new Error('blocked')
      return retryResult.stdout
    }
    throw new Error('blocked')
  }

  return result.stdout
}
