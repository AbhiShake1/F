import { spawnSync } from 'child_process'

// curl.md returns errors as a markdown table: | code | FETCH_FAILED | / | message | ... |
function parseCurlMdError(output) {
  if (!output.includes('FETCH_FAILED') && !output.includes('| code')) return null
  const msg = output.match(/\|\s*message\s*\|\s*([^|]+)\|/)
  return msg ? msg[1].trim() : 'fetch failed'
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

  const curlErr = parseCurlMdError(stdout)
  if (curlErr) {
    if (isBlocked(curlErr) || isBlocked(stdout)) throw new Error('blocked')
    throw new Error(curlErr)
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
