import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'excelsofttechnologies'
export const COMPANY = 'ExcelSoft Technologies'
export const CAREER_PAGE_URL = 'https://www.excelsoftcorp.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const hasOfficialZohoEmptyState = (html) => {
  const body = String(html ?? '')
  return /rec_embed_js\.load\(\{[\s\S]*?page_name:"Excelsoft-Technology"/i.test(body)
    && /site:"https:\/\/excelsoftcorp\.zohorecruit\.com"/i.test(body)
    && /empty_job_msg:"No current Openings"/i.test(body)
}

const hasExplicitPublicOpeningsSignal = (html) => {
  const body = String(html ?? '')
  const hasOpeningsHeading = /<h[1-6][^>]*>\s*(Open Positions|Current Openings|Job Openings)\s*<\/h[1-6]>/i.test(body)
  const hasApplyLink = />\s*Apply Now\s*</i.test(body)
    || /href=["'][^"']*(\/career\/apply\/|excelsoftcorp\.zohorecruit\.com\/jobs)/i.test(body)

  return hasOpeningsHeading && hasApplyLink
}

export const isVerifiedBrandingOnlySurface = (html) => {
  const body = String(html ?? '')
  return /One Team One Dream/i.test(body)
    && /Being an Excelian is just a choice away/i.test(body)
    && (hasOfficialZohoEmptyState(body) || !hasExplicitPublicOpeningsSignal(body))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createExcelsoftTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!isVerifiedBrandingOnlySurface(html)) {
      throw new Error(
        'The verified Excelsoft no-public-openings surface changed; keep this provider fail-closed until it is re-verified.',
      )
    }

    const scrapedAt = (overrideNow || now)()
    void scrapedAt
    return []
  },
})

export const run = async (options = {}) => createExcelsoftTechnologiesScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
