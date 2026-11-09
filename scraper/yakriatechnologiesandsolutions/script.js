import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yakriatechnologiesandsolutions'
export const COMPANY = 'Yakria Technologies and Solutions'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'On July 13, 2026, the verified first-party public surface for Yakria Technologies and Solutions was https://www.ytechsol.com/: the homepage was a marketing site, /careers and /careers/ resolved to https://www.ytechsol.com/recruitment-services#careers, /recruitment-services was a staffing-services page without public openings, /jobs and /jobs/ returned a stable first-party 404, and the sitemap indexed recruitment-services but no public jobs board.'
export const HOMEPAGE_URL = 'https://www.ytechsol.com/'
export const RECRUITMENT_SERVICES_URL = 'https://www.ytechsol.com/recruitment-services'
export const SITEMAP_URL = 'https://www.ytechsol.com/sitemap.xml'
export const CAREERS_ALIAS_URLS = [
  'https://www.ytechsol.com/careers',
  'https://www.ytechsol.com/careers/',
]
export const MISSING_JOBS_URLS = [
  'https://www.ytechsol.com/jobs',
  'https://www.ytechsol.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /icims/i,
  /darwinbox/i,
  /taleo/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0027/gi, "'")
    .replace(/\\u002f/gi, '/')
    .replace(/\\u003a/gi, ':')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#x2f;/gi, '/')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const rawLower = rawHtml.toLowerCase()
  const normalized = normalizeText(html)

  return normalized.includes('yts | brand & digital design agency - yakria technologies and solutions')
    && rawLower.includes('headquartered in chennai &amp; coimbatore')
    && normalized.includes('yakria technologies and solutions')
    && normalized.includes('info@ytechsol.com')
    && normalized.includes('https://www.linkedin.com/company/ytechsol/')
}

export const hasOfficialRecruitmentServicesSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const rawLower = rawHtml.toLowerCase()
  const normalized = normalizeText(html)

  return normalized.includes('recruitment & staffing services - build your future team | yts')
    && rawLower.includes('comprehensive staffing solutions tailored to your unique business needs. we don&#x27;t just fill roles, we build futures with the right people.')
    && normalized.includes('average placement in 21 days')
    && normalized.includes('95% candidate retention rate after 12 months')
    && normalized.includes('technology & it')
    && rawLower.includes('https://www.ytechsol.com/recruitment-services')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedCareersAlias = (page = {}) => {
  const finalUrl = String(page.url ?? '').toLowerCase()

  return Number(page.status) === 200
    && finalUrl.includes('/recruitment-services')
    && hasOfficialRecruitmentServicesSignal(page.html)
    && !hasPublicJobsSignal(page.html)
}

export const isVerifiedMissingJobsRoute = (status, html = '') => {
  const rawHtml = String(html ?? '')

  return Number(status) === 404
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(rawHtml)
    && /aria-labelledby=["']not-found-heading["']/i.test(rawHtml)
    && /\/jobs\b/i.test(rawHtml)
}

export const isVerifiedSitemap = (xml = '') => {
  const rawXml = String(xml ?? '')

  return rawXml.includes('https://www.ytechsol.com/recruitment-services')
    && !rawXml.includes('https://www.ytechsol.com/jobs')
    && !rawXml.includes('https://www.ytechsol.com/careers')
}

export const createYakriaTechnologiesAndSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Yakria Technologies and Solutions verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Yakria Technologies and Solutions homepage now appears to expose a public jobs surface')
    }

    const recruitmentServicesPage = await fetchPage(RECRUITMENT_SERVICES_URL)

    if (recruitmentServicesPage.status !== 200 || !hasOfficialRecruitmentServicesSignal(recruitmentServicesPage.html)) {
      throw new Error('Yakria Technologies and Solutions verified recruitment services page no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(recruitmentServicesPage.html)) {
      throw new Error('Yakria Technologies and Solutions recruitment services page now appears to expose a public jobs surface')
    }

    for (const careersUrl of CAREERS_ALIAS_URLS) {
      const careersPage = await fetchPage(careersUrl)

      if (!isVerifiedCareersAlias(careersPage)) {
        throw new Error(`Yakria Technologies and Solutions verified careers alias changed materially: ${careersUrl}`)
      }
    }

    for (const jobsUrl of MISSING_JOBS_URLS) {
      const jobsPage = await fetchPage(jobsUrl)

      if (hasPublicJobsSignal(jobsPage.html)) {
        throw new Error(`Yakria Technologies and Solutions jobs route now appears to expose a public jobs surface: ${jobsUrl}`)
      }

      if (!isVerifiedMissingJobsRoute(jobsPage.status, jobsPage.html)) {
        throw new Error(`Yakria Technologies and Solutions verified missing jobs route changed materially: ${jobsUrl}`)
      }
    }

    const sitemap = await fetchPage(SITEMAP_URL)

    if (sitemap.status !== 200 || !isVerifiedSitemap(sitemap.html)) {
      throw new Error('Yakria Technologies and Solutions verified sitemap no longer matches the trusted no-public-jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createYakriaTechnologiesAndSolutionsScraper().run(options)

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
