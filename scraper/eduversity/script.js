import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://edu-versity.in/'
export const COMMUNITY_URL = 'https://edu-versity.in/join-our-community/'

const OFFICIAL_SITE_SIGNAL_PATTERNS = [
  /<title>\s*Home\s*-\s*Edu-?versity/i,
  /Start Your Upskilling Journey/i,
  /Explore from our wide range of specialised programs and kickstart your career/i,
  /www\.linkedin\.com\/company\/edu-versity/i,
]

const CONTACT_SIGNAL_PATTERNS = [
  /admin@edu-versity\.in/i,
  /HSR\s+layout,\s*Bengaluru,\s*Karnataka,\s*560102/i,
]

const PINNED_COMMUNITY_LINK_PATTERN = /https?:\/\/(?:www\.)?edu-versity\.in\/join-our-community\/?/i

const COMMUNITY_FORM_SIGNAL_PATTERNS = [
  /<title>\s*Join Our Community\s*-\s*Edu-?versity/i,
  /Join Our Community/i,
  /<form\b/i,
  /Full Name/i,
  /Email(?: Address)?/i,
  /Phone Number/i,
]

const PUBLIC_JOBS_SIGNAL_PATTERN = /\b(current openings|job openings|open positions|vacancies|we are hiring|hiring now)\b|class=["'][^"']*job-card[^"']*["']/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'eduversity',
  timeoutMs: 15000,
})

export const hasOfficialSiteSignal = (html) =>
  OFFICIAL_SITE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasContactSignal = (html) =>
  CONTACT_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasPinnedCommunityLinkSignal = (html) =>
  PINNED_COMMUNITY_LINK_PATTERN.test(String(html ?? ''))

export const hasCommunityFormSignal = (html) =>
  COMMUNITY_FORM_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractOpenings = () => []

const hasHttpStatusInCauseChain = (error, status) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current?.status === status) {
      return true
    }
    current = current?.cause
  }

  return false
}

export const createEduversityScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml) || !hasContactSignal(homepageHtml)) {
      return []
    }

    let communityHtml
    try {
      communityHtml = await fetchText(COMMUNITY_URL)
    } catch (error) {
      if (hasHttpStatusInCauseChain(error, 404) && hasPinnedCommunityLinkSignal(homepageHtml)) {
        return []
      }

      throw error
    }

    if (hasPublicJobsSignal(communityHtml)) {
      throw new Error('Edu-versity site now exposes public job listings; scraper needs an update')
    }

    if (!hasCommunityFormSignal(communityHtml)) {
      return []
    }

    const jobs = extractOpenings(communityHtml)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createEduversityScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Edu-versity scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'eduversity')
    console.log('DB result:', result)
    process.exit(0)
  }
}
