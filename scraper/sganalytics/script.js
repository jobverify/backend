import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.sganalytics.com/careers/jobs/'
export const LISTING_FRAGMENT_URL = 'https://www.sganalytics.com/careers/current-opening.get_related_jobs?ajax=true'

const SOURCE = 'sganalytics'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html) =>
  /Current Opening/i.test(html || '')
  && /(Job Function|Business Insights|Technology Services)/i.test(html || '')

export const hasEmailApplyFallback = (html) =>
  /careers@sganalytics\.com/i.test(html || '')
  && /e-?mailing your resume and cover letter/i.test(html || '')

export const hasVisibleOpeningsSignal = (html) =>
  /<a\b|job-title|current-opening-card|opening-item|view\s+job|apply\s+now/i.test(html || '')

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSgAnalyticsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SG Analytics careers page no longer matches the verified official public surface')
    }

    if (!hasEmailApplyFallback(careersHtml)) {
      throw new Error('SG Analytics careers page no longer matches the verified email apply fallback')
    }

    const fragmentHtml = await fetchText(LISTING_FRAGMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: 'o_unit=&search_k=',
    })

    if (hasVisibleOpeningsSignal(fragmentHtml)) {
      throw new Error('SG Analytics listing endpoint no longer matches the verified empty openings surface')
    }

    return []
  },
})

export const run = async () => createSgAnalyticsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SG Analytics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
