import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'waferspace'
export const COMPANY = 'Wafer Space'
export const HOMEPAGE_URL = 'https://waferspace.com/'
export const REDIRECT_TARGET_URL = 'https://www.acldigital.com/industries/semiconductor'
export const CAREERS_URL = 'https://waferspace.com/careers'
export const JOBS_URL = 'https://waferspace.com/jobs'
export const ACL_CAREERS_URL = 'https://www.acldigital.com/careers'
export const ACL_INDIA_JOBS_URL = 'https://recruitment.acldigital.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
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
  /zohorecruit/i,
]

const NOT_FOUND_SIGNAL_PATTERNS = [
  /\b404\b/i,
  /\bpage not found\b/i,
  /\bnot found\b/i,
  /\bcannot find\b/i,
  /\bdoesn'?t exist\b/i,
]

const WAFERSPACE_HIRING_SIGNAL_PATTERNS = [
  /\bwafer\s*space careers\b/i,
  /\bwafer\s*space jobs\b/i,
  /\bjoin wafer\s*space\b/i,
  /jobs\.lever\.co\/waferspace/i,
  /boards\.greenhouse\.io\/waferspace/i,
  /ashbyhq\.com\/waferspace/i,
  /myworkdayjobs.*waferspace/i,
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

const isOfficialWaferSpaceUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'waferspace.com' || hostname === 'www.waferspace.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasWaferSpaceSpecificHiringSignal = (html) =>
  WAFERSPACE_HIRING_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialRedirectTargetSignal = (page = {}) => {
  if (Number(page.status) !== 200) {
    return false
  }

  if ((page.url || '') !== REDIRECT_TARGET_URL) {
    return false
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return normalized.includes('innovative solutions for semiconductor industry')
    && normalized.includes('from design to silicon, power the future with our full-cycle vlsi expertise')
    && normalized.includes('leading complete vlsi design and production with our spec-to-silicon excellence')
    && normalized.includes('acl digital')
}

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (!isOfficialWaferSpaceUrl(page.url)) {
    return false
  }

  if (hasPublicJobsSignal(page.html) || hasWaferSpaceSpecificHiringSignal(page.html)) {
    return false
  }

  if (Number(page.status) === 404) {
    return true
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return NOT_FOUND_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const hasGenericAclCareersHandoff = (html) => {
  const page = String(html ?? '')

  return /careers\s*-\s*acl digital/i.test(page)
    && /jobs in india/i.test(page)
    && /https:\/\/recruitment\.acldigital\.com\//i.test(page)
    && /jobs in the usa/i.test(page)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createWaferSpaceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if ((homepage.url || '') === REDIRECT_TARGET_URL
      && (hasPublicJobsSignal(homepage.html) || hasWaferSpaceSpecificHiringSignal(homepage.html))) {
      throw new Error('Wafer Space official redirect target now appears to expose hiring content')
    }

    if (!hasOfficialRedirectTargetSignal(homepage)) {
      throw new Error('Wafer Space official homepage redirect no longer matches the verified public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isVerifiedMissingCareersRoute(careersPage)) {
      throw new Error('Wafer Space /careers no longer matches the verified missing-route surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (!isVerifiedMissingCareersRoute(jobsPage)) {
      throw new Error('Wafer Space /jobs no longer matches the verified missing-route surface')
    }

    const aclCareersPage = await fetchPage(ACL_CAREERS_URL)
    if (!hasGenericAclCareersHandoff(aclCareersPage.html)) {
      throw new Error('ACL Digital careers handoff no longer matches the verified generic parent-company surface')
    }

    if (hasWaferSpaceSpecificHiringSignal(aclCareersPage.html)) {
      throw new Error('ACL Digital careers handoff now appears to mention Wafer Space-specific hiring')
    }

    const aclIndiaJobsPage = await fetchPage(ACL_INDIA_JOBS_URL)
    if (!/ACL Digital/i.test(String(aclIndiaJobsPage.html ?? ''))) {
      throw new Error('ACL Digital India jobs portal no longer matches the verified parent-company identity')
    }

    if (hasWaferSpaceSpecificHiringSignal(aclIndiaJobsPage.html)) {
      throw new Error('ACL Digital India jobs portal now appears to expose Wafer Space-specific hiring')
    }

    return []
  },
})

export const run = async (options = {}) => createWaferSpaceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Wafer Space scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
