import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.codeyoung.com/trainer-register'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const MENTOR_APPLICATION_SIGNAL_PATTERN = /apply as a mentor(?:\s+at codeyoung)?|trainer-register|enter email|whatsapp or phone/i
const CONTACT_SIGNAL_PATTERN = /support@codeyoung\.com/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'codeyoung',
  timeoutMs: 15000,
})

export const hasMentorApplicationSignal = (html) =>
  MENTOR_APPLICATION_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasContactSignal = (html) =>
  CONTACT_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractJobs = () => []

export const createCodeyoungScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasMentorApplicationSignal(html)) {
      throw new Error('Codeyoung mentor application page no longer exposes public mentor-application signals')
    }

    if (!hasContactSignal(html)) {
      throw new Error('Codeyoung mentor application page no longer exposes the official support contact')
    }

    const jobs = extractJobs(html)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createCodeyoungScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Codeyoung scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'codeyoung')
    console.log('DB result:', result)
    process.exit(0)
  }
}
