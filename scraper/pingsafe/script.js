import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.pingsafe.com/'
export const EXPECTED_DESTINATION_URL =
  'https://www.sentinelone.com/platform/singularity-cloud-native-security/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const isExpectedDestinationUrl = (value) => {
  try {
    return new URL(value).toString() === EXPECTED_DESTINATION_URL
  } catch {
    return false
  }
}

export const hasVerifiedDestinationSignal = (html) => {
  const page = String(html ?? '')

  return /Singularity(?:™)?\s+Cloud Native Security/i.test(page)
    && /SentinelOne/i.test(page)
    && /Verified Exploit Paths/i.test(page)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()

  return {
    finalUrl: response.url,
    html,
  }
}

export const createPingSafeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(HOMEPAGE_URL)
    const finalUrl = page?.finalUrl || page?.url || HOMEPAGE_URL
    const html = page?.html || ''

    if (!isExpectedDestinationUrl(finalUrl) || !hasVerifiedDestinationSignal(html)) {
      throw new Error('Ping Safe official domain no longer matches the verified official public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createPingSafeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'pingsafe')
  }
}
