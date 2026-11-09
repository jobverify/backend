import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.doozyrobotics.com/career.html'

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

export const hasCareerPageSignal = (html) => {
  const value = String(html || '')
  return (
    /Join\s+Our\s+Robotics\s+Team/i.test(value)
    && /id=["']career-form["']/i.test(value)
    && /<select[^>]+id=["']role["']/i.test(value)
  )
}

export const createDoozyRoboticsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careerPageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasCareerPageSignal(careerPageHtml)) {
      return []
    }

    // The official form exposes role categories but no opening records or detail URLs.
    return []
  },
})

export const run = async () => createDoozyRoboticsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Doozy Robotics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'doozyrobotics')
    console.log('DB result:', result)
    process.exit(0)
  }
}
