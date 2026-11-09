import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.trianz.com/careers'
export const INDIA_HANDOFF_URL = 'https://recruit.trianz.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    normalized.includes('trianz')
    && normalized.includes('careers')
    && (
      normalized.includes('future-ready')
      || normalized.includes('build a career')
      || normalized.includes('careers at trianz')
    )
  )
}

export const hasIndiaHandoffSignal = (html) => {
  const raw = String(html ?? '').toLowerCase()
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    raw.includes('recruit.trianz.com')
    && normalized.includes('india')
  )
}

export const hasRecruitShellSignal = (html) => {
  const raw = String(html ?? '')
  return /<title>\s*Trianz - Careers\s*<\/title>/i.test(raw)
    && /<meta[^>]+name=["']description["'][^>]+content=["']career opportunity for Leaders in Product Engineering, Hybrid Cloud Consulting, IT infrastructure services, managed services and IT security consulting\.["']/i.test(raw)
    && /<base[^>]+href=["']\/trianz\/["']/i.test(raw)
    && /<script[^>]+src=/i.test(raw)
}

export const hasUnreachableRecruitSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    status >= 400
    || normalized.includes('access denied')
    || normalized.includes('forbidden')
    || normalized.includes('not found')
    || normalized.includes('no access')
  )
}

const isExpectedRecruitFailure = (error) => {
  const normalized = normalizeWhitespace(error?.message).toLowerCase()

  return (
    normalized.includes('econnrefused')
    || normalized.includes('enotfound')
    || normalized.includes('timed out')
    || normalized.includes('fetch failed')
    || normalized.includes('networkerror')
  )
}

export const createTrianzScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Trianz careers page no longer matches the verified official public surface')
    }

    if (!hasIndiaHandoffSignal(careersPage.html)) {
      throw new Error('Trianz careers page no longer exposes the verified India handoff')
    }

    try {
      const recruitPage = await fetchPage(INDIA_HANDOFF_URL)
      if (hasUnreachableRecruitSignal(recruitPage) || hasRecruitShellSignal(recruitPage.html)) {
        return maxJobs ? [].slice(0, maxJobs) : []
      }

      throw new Error('Trianz recruit host no longer matches the verified unreachable state')
    } catch (error) {
      if (isExpectedRecruitFailure(error)) {
        return maxJobs ? [].slice(0, maxJobs) : []
      }

      throw error
    }
  },
})

export const run = async () => createTrianzScraper().run()

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Trianz scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'trianz')
    console.log('DB result:', result)
    process.exit(0)
  }
}
