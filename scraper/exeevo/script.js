import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://exeevo.com/about-us/careers/'
export const BAMBOOHR_JOBS_URL = 'https://exeevo.bamboohr.com/jobs/'

export const hasOfficialCareersSignal = (html) =>
  /Careers Designed to Empower\s*\|\s*Exeevo|Current Job Openings/i.test(html || '')

export const hasEmptyOpeningsSignal = (html) =>
  /There are no roles open at this time\./i.test(html || '')

export const hasBambooHrHandoff = (html) =>
  /https:\/\/exeevo\.bamboohr\.com\/jobs\/|career opportunities/i.test(html || '')

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createExeevoScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Exeevo careers page no longer matches the verified official public surface')
    }

    if (!hasBambooHrHandoff(html)) {
      throw new Error('Exeevo careers page no longer exposes the verified BambooHR handoff')
    }

    if (!hasEmptyOpeningsSignal(html)) {
      throw new Error('Exeevo careers page no longer matches the verified no-open-roles surface')
    }

    return []
  },
})

export const run = async (options = {}) => createExeevoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Exeevo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'exeevo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
