import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cloudnine'
export const COMPANY = 'Cloudnine'
export const HOMEPAGE_URL = 'https://www.cloudninecare.com/'
export const CAREERS_URL = 'https://www.cloudninecare.com/career'
export const RESUME_EMAIL = 'hr@cloudninecare.com'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  companyDomain: 'cloudninecare.com',
  adapter: 'script',
  atsPlatform: 'official-company-careers',
  modulePath: '../../scraper/cloudnine/script.js',
  dryRunFile: 'cloudnine/jobs.json',
  paginationStrategy: 'homepage-plus-single-careers-page',
  extractionStrategy: 'verified-homepage-plus-resume-only-careers-page-return-empty',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /keka\.com\/careers/i,
  /zohorecruit/i,
  /linkedin\.com\/jobs/i,
  /linkedin\.com\/company\/[^/"']+\/jobs/i,
  /href=["'][^"']*\/career\/[^"']+["']/i,
  /href=["'][^"']*\/(?:jobs|job)\/[^"']+["']/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasVerifiedHomepageCareerLink = (html) => {
  const rawHtml = String(html ?? '')

  return /<title[^>]*>[\s\S]*Cloudnine Hospitals[\s\S]*<\/title>/i.test(rawHtml)
    && /href=["'](?:https:\/\/www\.cloudninecare\.com)?\/career["'][^>]*>\s*Career\s*</i.test(rawHtml)
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Career\s*-\s*Join our Team\s*\|\s*Cloudnine Hospitals\s*<\/title>/i.test(rawHtml)
    && /\bJoin Our Team\b/i.test(normalized)
    && /\bCloudnine Hospitals\b/i.test(normalized)
    && /Send\s+your\s+resume\s+at\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(rawHtml)
}

export const extractResumeEmail = (html) => {
  const match = String(html ?? '').match(
    /send\s+your\s+resume\s+at\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  )

  return match?.[1]?.toLowerCase() ?? null
}

export const extractKnownEmails = (html) => {
  const matches = String(html ?? '').match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  ) || []

  return [...new Set(matches.map((value) => value.toLowerCase()))]
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createCloudnineScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasVerifiedHomepageCareerLink(homepageHtml)) {
      throw new Error('Cloudnine official homepage no longer links to the known career route')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Cloudnine verified resume-only careers page no longer matches the known public surface')
    }

    if (extractResumeEmail(careersHtml) !== RESUME_EMAIL) {
      throw new Error('Cloudnine verified careers resume email changed')
    }

    if (hasUnexpectedPublicJobsSignal(careersHtml)) {
      throw new Error('Cloudnine careers page now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createCloudnineScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}

