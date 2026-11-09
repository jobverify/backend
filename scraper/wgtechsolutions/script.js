import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wgtechsolutions'
export const COMPANY = 'WG Tech Solutions'
export const HOMEPAGE_URL = 'https://www.wgtechsolutions.com/'
export const ABOUT_URL = 'https://www.wgtechsolutions.com/about-us'
export const CAREERS_ROUTE_URLS = [
  'https://www.wgtechsolutions.com/careers',
  'https://www.wgtechsolutions.com/careers/',
  'https://www.wgtechsolutions.com/career',
  'https://www.wgtechsolutions.com/career/',
  'https://www.wgtechsolutions.com/jobs',
  'https://www.wgtechsolutions.com/jobs/',
  'https://www.wgtechsolutions.com/join-us',
  'https://www.wgtechsolutions.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /recruitcrm/i,
]

const NOT_FOUND_SIGNAL_PATTERNS = [
  /\b404\b/i,
  /\bpage not found\b/i,
  /\bnot found\b/i,
  /\bdoesn'?t exist\b/i,
  /\bcan'?t find\b/i,
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

const isSameOfficialDomain = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'www.wgtechsolutions.com' || hostname === 'wgtechsolutions.com'
  } catch {
    return false
  }
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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /WG Tech Solutions/i.test(page)
    && normalized.includes('Solve Real-World Problems Using AI !!')
    && normalized.includes('Experience power of automation and AI meeting your organizations budget and ROI')
    && normalized.includes('WGTech AI in Action: Transforming Industries')
    && normalized.includes('WG Tech Solutions Pvt Ltd')
    && normalized.includes('support@wgtech.ai')
    && /href=["'](?:https:\/\/www\.wgtechsolutions\.com)?\/about-us["']/i.test(page)
    && /href=["'](?:https:\/\/www\.wgtechsolutions\.com)?\/contact-us["']/i.test(page)
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About Us')
    && normalized.includes('WGTech is a privately owned technology company focused on providing cutting-edge AI services to build, train and deploy custom AI models at the Edge.')
    && normalized.includes('Our end markets include Industrial, Agriculture, Medical and Automotive businesses.')
    && normalized.includes('WG Tech Solutions Pvt Ltd')
    && normalized.includes('support@wgtech.ai')
}

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  if (Number(page.status) === 404) {
    return true
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return hasOfficialHomepageSignal(page.html)
    || hasOfficialAboutSignal(page.html)
    || NOT_FOUND_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const createWgTechSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('WG Tech Solutions homepage no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('WG Tech Solutions homepage now appears to expose public jobs')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('WG Tech Solutions about page no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(aboutPage.html)) {
      throw new Error('WG Tech Solutions about page now appears to expose public jobs')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('WG Tech Solutions careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createWgTechSolutionsScraper().run(options)

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
