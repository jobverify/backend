import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://careers.gehealthcare.com/global/en'

export const hasOfficialCareersSurface = (html) => {
  const source = String(html ?? '')

  return /<title[^>]*>\s*Careers at GE HealthCare\s*\|\s*GE HealthCare jobs\s*<\/title>/i.test(source)
    && /Create the future of healthcare/i.test(source)
    && /Search(?:\s|&nbsp;|&#xa0;)+Jobs/i.test(source)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createGeHealthCareScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSurface(html)) {
      throw new Error('GE HealthCare page no longer matches the verified official GE HealthCare careers surface')
    }

    // The public jobs route is client-rendered without a stable listed payload.
    return []
  },
})

export const run = async (options = {}) => createGeHealthCareScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running GE HealthCare scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'gehealthcare')
    console.log('DB result:', result)
    process.exit(0)
  }
}
