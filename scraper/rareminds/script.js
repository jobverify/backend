import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.rareminds.in/'
export const COMPANY_DOMAIN = 'rareminds.in'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(job openings|open roles|current openings|careers|apply now|apply as talent|airtable|greenhouse|lever|workday|jobvite)\b/i

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Rareminds\s*<\/title>/i.test(page)
    && /<div id="root"><\/div>/i.test(page)
    && /\/assets\/index-[^"']+\.(?:js|css)/i.test(page)
}

export const hasNoPublicListingsSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialSiteSignal(page)
    && !PUBLIC_JOBS_SIGNAL_PATTERN.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'rareminds',
  timeoutMs: 15000,
})

export const createRaremindsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(html)) {
      throw new Error('Rareminds homepage no longer matches the verified official public surface')
    }

    if (!hasNoPublicListingsSignal(html)) {
      throw new Error('Rareminds homepage no longer matches the verified no-public-listings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createRaremindsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Rareminds scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'rareminds')
    console.log('DB result:', result)
    process.exit(0)
  }
}
