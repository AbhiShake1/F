import { spawnSync } from 'child_process'

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
  return { stdout: result.stdout || '', status: result.status }
}

/**
 * fetchUrl(url) → string
 */
export async function fetchUrl(url) {
  // Normalize: prepend https:// if no scheme
  let normalizedUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url
  }

  // Try primary URL
  let result
  try {
    result = runMd(normalizedUrl)
  } catch (err) {
    if (err.message && err.message.startsWith('missing:')) throw err
    // Connection error on https → retry with http
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      result = runMd(httpUrl)
    } else {
      throw err
    }
  }

  if (isBlocked(result.stdout)) {
    // If was https, retry with http
    if (normalizedUrl.startsWith('https://')) {
      const httpUrl = 'http://' + normalizedUrl.slice(8)
      let retryResult
      try {
        retryResult = runMd(httpUrl)
      } catch {
        throw new Error('blocked')
      }
      if (isBlocked(retryResult.stdout)) {
        throw new Error('blocked')
      }
      return retryResult.stdout
    }
    throw new Error('blocked')
  }

  return result.stdout
}
