import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://eleation.com/'
export const CAREERS_URL = 'https://www.eleation.com/career/'
export const PLACEMENT_PROCEDURE_URL = 'https://www.eleation.com/career/placement_procedure.php'

const SOURCE = 'eleation'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /ELEATION/i.test(page)
    && /CAD-CAE Training\s*&amp;\s*CAE Services|CAD-CAE Training\s*&\s*CAE Services/i.test(page)
    && /href=["']https?:\/\/(?:www\.)?eleation\.com\/career\/?["']/i.test(page)
}

export const hasApplicationOnlyCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Career at ELEATION/i.test(page)
    && /Internship\s*&amp;\s*Placement Opportunities|Internship\s*&\s*Placement Opportunities/i.test(page)
    && /Submit your career enquiry/i.test(page)
    && /Internship Enquiry Form/i.test(page)
    && /Placement Enquiry Form/i.test(page)
    && /Interested Job Role/i.test(page)
    && !/job id|requisition|current openings|open positions|view details|job description/i.test(page)
}

export const hasPlacementProcedureSignal = (html) => {
  const page = String(html ?? '')
  return /placement procedure/i.test(page)
    && /Submit your placement enquiry from the career page/i.test(page)
    && /current requirements/i.test(page)
    && /suitable roles/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEleationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('ELEATION homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasApplicationOnlyCareersSignal(careersHtml)) {
      throw new Error('ELEATION careers page no longer matches the verified application-only enquiry surface')
    }

    const placementHtml = await fetchText(PLACEMENT_PROCEDURE_URL)
    if (!hasPlacementProcedureSignal(placementHtml)) {
      throw new Error('ELEATION placement procedure page no longer matches the verified official public flow')
    }

    return []
  },
})

export const run = async (options = {}) => createEleationScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ELEATION scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
