import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.accelero-corp.com/'
export const CAREERS_ROUTE_URL = 'https://www.accelero-corp.com/careers'
export const JOBS_ROUTE_URL = 'https://www.accelero-corp.com/jobs'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job opening|job openings|vacancy|vacancies|join us)\b/i
const MISSING_ROUTE_PATTERN = /\b404 not found\b/i

export const hasOfficialSiteSignal = (html) =>
  /Accelero Corporation/i.test(html || '')

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(html || '')

export const isMissingCareerRoute = (html) => MISSING_ROUTE_PATTERN.test(html || '')

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createAcceleroIsaScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const homepageHtml = await fetchText(CAREER_PAGE_URL)
    const careersHtml = await fetchText(CAREERS_ROUTE_URL)
    const jobsHtml = await fetchText(JOBS_ROUTE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      throw new Error('Accelero official site no longer exposes the expected company identity')
    }

    const careersRouteMissing = isMissingCareerRoute(careersHtml)
    const jobsRouteMissing = isMissingCareerRoute(jobsHtml)

    if (careersRouteMissing && jobsRouteMissing) return []

    if (
      !hasCareersSignal(homepageHtml)
      && !hasCareersSignal(careersHtml)
      && !hasCareersSignal(jobsHtml)
    ) {
      return []
    }

    // The official site has no public structured or listed openings to extract.
    return []
  },
})

export const run = async () => createAcceleroIsaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Accelero (ISA) scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'acceleroisa')
    console.log('DB result:', result)
    process.exit(0)
  }
}
