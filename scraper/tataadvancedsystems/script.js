import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.tataadvancedsystems.com/careers'
export const PORTAL_URL = 'https://chroma.tcsapps.com/webhcm/tslt/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    normalized.includes('tata advanced systems')
    && normalized.includes('find open positions here')
    && normalized.includes('join our talent community')
    && normalized.includes('career@tataadvancedsystems.com')
  )
}

export const hasPortalHandoffSignal = (html) => {
  const raw = String(html ?? '').toLowerCase()
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    raw.includes(PORTAL_URL.toLowerCase())
    && normalized.includes('apply for open positions')
  )
}

export const hasPortalShellSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    status === 200
    && normalized.includes('career portal')
    && normalized.includes('register')
    && normalized.includes('login')
    && normalized.includes('saved search')
    && normalized.includes('powered by tcs platform solutions')
  )
}

const isExpectedPortalFailure = (error) => {
  const normalized = normalizeWhitespace(error?.message).toLowerCase()

  return (
    normalized.includes('econnrefused')
    || normalized.includes('etimedout')
    || normalized.includes('timed out')
    || normalized.includes('fetch failed')
    || normalized.includes('networkerror')
    || normalized.includes('enotfound')
    || normalized.includes('ehostunreach')
    || normalized.includes('could not connect to server')
    || normalized.includes('failed to connect')
  )
}

export const createTataAdvancedSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Tata Advanced Systems careers page no longer matches the verified official public surface')
    }

    if (!hasPortalHandoffSignal(careersPage.html)) {
      throw new Error('Tata Advanced Systems careers page no longer exposes the verified public TCS handoff')
    }

    try {
      const portalPage = await fetchPage(PORTAL_URL)
      if (hasPortalShellSignal(portalPage)) {
        return maxJobs ? [].slice(0, maxJobs) : []
      }

      throw new Error('Tata Advanced Systems portal no longer matches the verified shell or unreachable state')
    } catch (error) {
      if (isExpectedPortalFailure(error)) {
        return maxJobs ? [].slice(0, maxJobs) : []
      }

      throw error
    }
  },
})

export const run = async () => createTataAdvancedSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tata Advanced Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tataadvancedsystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
