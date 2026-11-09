import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.comviva.com/careers/explore-opportunity/'
export const CEIPAL_WIDGET_URL = 'https://jobsapi.ceipal.com/APISource/v2/index.html?bgcolor=eb2227&api_key=VkZUbnpKcFNPaUFzWitxQUNzU25sZz09&cp_id=Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'comviva',
  timeoutMs: 15000,
})

export const hasCareersPageSignal = (html) => {
  const normalized = String(html ?? '').toLowerCase()
  return (
    normalized.includes('be part of the comviva journey')
    && normalized.includes('jobsapi.ceipal.com/apisource/widget.js')
    && normalized.includes('data-ceipal-career-portal-id')
  )
}

export const hasWidgetSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return (
    normalized.includes('ceipal career portal')
    && normalized.includes('search jobs')
    && normalized.includes('current openings')
  )
}

export const extractOpeningCount = (html) => {
  const normalized = normalizeWhitespace(html)
  const match = normalized?.match(/\b(\d+)\s+Current Openings\b/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export const extractOpenings = (html) => {
  if (!hasWidgetSignal(html)) {
    return []
  }

  const openingCount = extractOpeningCount(html)
  if (openingCount === 0) {
    return []
  }

  return []
}

export const createComvivaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasCareersPageSignal(careersPageHtml)) {
      return []
    }

    const widgetHtml = await fetchText(CEIPAL_WIDGET_URL)
    const jobs = extractOpenings(widgetHtml)

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createComvivaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Comviva scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'comviva')
    console.log('DB result:', result)
    process.exit(0)
  }
}
