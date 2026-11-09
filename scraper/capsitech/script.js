import path from 'path'
import { fileURLToPath } from 'url'
import { runCurrentPublicCapsitech } from './currentPublic.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.capsitech.com/career/'
export const CAREER_OPTIONS_URL = 'https://www.capsitech.com/wp-content/themes/capsitech/api/api-get-career-options.php'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasCareerPageSignal = (html) => {
  const value = String(html || '')
  return (
    /capsitech/i.test(value)
    && /id=["']Carrer_Form["']/i.test(value)
    && /id=["']Job_Position["']/i.test(value)
  )
}

export const extractResumeKey = (html) =>
  String(html || '').match(/window\.RESUME_KEY\s*=\s*['"]([^'"]+)['"]/i)?.[1] || null

export const buildCareerOptionsUrl = (resumeKey) =>
  `${CAREER_OPTIONS_URL}?resumeKey=${encodeURIComponent(resumeKey)}`

export const hasPublicPositionOptions = (payload) =>
  Array.isArray(payload?.result?.domainsList)
  && payload.result.domainsList.some((group) =>
    Array.isArray(group?.domains)
    && group.domains.some((domain) => typeof domain?.name === 'string' && domain.name.trim()),
  )

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createCapsitechScraper = () => ({
  async run(options = {}) {
    return runCurrentPublicCapsitech(options)
  },
})

export const run = async (options = {}) => createCapsitechScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Capsitech scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'capsitech')
    console.log('DB result:', result)
    process.exit(0)
  }
}
