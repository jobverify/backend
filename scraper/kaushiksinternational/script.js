import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kaushiksinternational'
export const COMPANY = 'KAUSHIKS INTERNATIONAL'
export const HOMEPAGE_URL = 'https://www.kaushiksinternational.com/'
export const CAREERS_ROUTE_URLS = [
  'https://www.kaushiksinternational.com/career',
  'https://www.kaushiksinternational.com/careers',
  'https://www.kaushiksinternational.com/jobs',
  'https://www.kaushiksinternational.com/job',
  'https://www.kaushiksinternational.com/openings',
  'https://www.kaushiksinternational.com/vacancies',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN = /href=["']https?:\/\/(?:www\.)?kaushiksinternational\.com\/(?:careers?|jobs?|openings?|vacanc(?:y|ies)|join-us)(?:[\/#?][^"']*)?["']|href=["']\/(?:careers?|jobs?|openings?|vacanc(?:y|ies)|join-us)(?:[\/#?][^"']*)?["']/i
const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*KAUSHIKS INTERNATIONAL - IMPROVING PRODUCTIVITY\s*<\/title>/i.test(rawHtml)
    && /\bKAUSHIKS INTERNATIONAL\b/i.test(normalized)
    && /For nearly 3 decades now, Kaushiks International has been bringing to the Indian Industry the world's best expertise by offering world class products\./i.test(normalized)
    && /Kaushiks International is the associate of global companies such as Flow Science(?:,\s*Inc\.,\s*USA)?(?: in India for their world-renowned Computational Fluid Dynamics \(CFD\) software FLOW-3D\.)?/i.test(normalized)
    && /Indiranagar,\s*bangalore,\s*INDIA/i.test(normalized)
    && /info\[at\]kaushiksinternational\[dot\]com/i.test(rawHtml)
    && /\+91-80-25288286/.test(rawHtml)
    && /\bPRODUCTS\b/i.test(normalized)
    && /\bACADEMICS\b/i.test(normalized)
    && /\bCONTACT US\b/i.test(normalized)
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html)

  return normalized === ''
    || (
      /404 Not Found/i.test(normalized)
      && /The resource requested could not be found on this server!/i.test(normalized)
      && /Proudly powered by LiteSpeed Web Server/i.test(normalized)
    )
}

export const createKaushiksInternationalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('KAUSHIKS INTERNATIONAL verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('KAUSHIKS INTERNATIONAL homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('KAUSHIKS INTERNATIONAL homepage now exposes a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('KAUSHIKS INTERNATIONAL careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKaushiksInternationalScraper().run(options)

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
