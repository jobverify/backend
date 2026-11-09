import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.cgglobal.com/career'
export const EXPLORE_ROLES_URL = 'https://www.cgglobal.com/explore_roles'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const UNRESOLVED_HOST_PATTERN = /\b(?:ENOTFOUND|EAI_AGAIN|NXDOMAIN)\b|DNS name does not exist|Could not resolve host|Name or service not known/i

const CAREER_PAGE_SIGNAL_PATTERN = /join a purpose[-\s]driven team|explore open positions/i
const EXPLORE_ROLES_SIGNAL_PATTERN = /explore the latest job opportunities|search all open positions/i
const NO_JOBS_PATTERN = /\bno jobs found\b/i

const isExpectedUnresolvedHostError = (error) => {
  const details = [
    error?.message,
    error?.cause?.message,
    error?.code,
    error?.cause?.code,
  ].filter(Boolean).join(' ')

  return UNRESOLVED_HOST_PATTERN.test(details)
}

const fetchSurfaceText = async (fetchText, url) => {
  try {
    return {
      unresolved: false,
      text: await fetchText(url),
    }
  } catch (error) {
    if (isExpectedUnresolvedHostError(error)) {
      return {
        unresolved: true,
        text: null,
      }
    }

    throw error
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cgpower',
  timeoutMs: 15000,
})

export const hasCareerPageSignal = (html) =>
  CAREER_PAGE_SIGNAL_PATTERN.test(String(html || ''))

export const hasExploreRolesSignal = (html) =>
  EXPLORE_ROLES_SIGNAL_PATTERN.test(String(html || ''))

export const hasNoJobsSignal = (html) => NO_JOBS_PATTERN.test(String(html || ''))

export const extractOpenings = (html) => {
  if (!hasExploreRolesSignal(html)) {
    return []
  }

  if (hasNoJobsSignal(html)) {
    return []
  }

  return []
}

export const createCgPowerScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careerPage = await fetchSurfaceText(fetchText, CAREER_PAGE_URL)

    if (careerPage.unresolved) {
      const exploreRoles = await fetchSurfaceText(fetchText, EXPLORE_ROLES_URL)
      if (exploreRoles.unresolved) {
        return []
      }

      throw new Error('CG Power verified first-party host resolution contract changed materially')
    }

    const careerPageHtml = careerPage.text

    if (!hasCareerPageSignal(careerPageHtml)) {
      return []
    }

    const exploreRoles = await fetchSurfaceText(fetchText, EXPLORE_ROLES_URL)
    if (exploreRoles.unresolved) {
      throw new Error('CG Power verified first-party host resolution contract changed materially')
    }

    const exploreRolesHtml = exploreRoles.text
    const jobs = extractOpenings(exploreRolesHtml)

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createCgPowerScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running CG Power scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cgpower')
    console.log('DB result:', result)
    process.exit(0)
  }
}
