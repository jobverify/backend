import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'smarthmssolutionspvtltd'
export const COMPANY = 'SmartHMS & Solutions Pvt Ltd'
export const HOMEPAGE_URL = 'https://smarthms.in/'
export const SITEMAP_URL = 'https://smarthms.in/sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://smarthms.in/careers',
  'https://smarthms.in/career',
  'https://smarthms.in/jobs',
  'https://smarthms.in/job-openings',
  'https://smarthms.in/work-with-us',
  'https://smarthms.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?smarthms\.in)?\/(?:careers?|jobs?|job-openings|join-us|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcareers at smarthms\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bwe(?:'|&apos;|&#39;|&rsquo;)?re hiring\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
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
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

export const hasOfficialHomepageSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)
  const hasLegacyMetadataSignals = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.smarthms\.in["']/i.test(raw)
    && /<meta[^>]+name=["']reply-to["'][^>]+content=["']info@smarthms\.in["']/i.test(raw)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']SmartHMS["']/i.test(raw)
  const hasCurrentInformationalShell = normalized.includes('Get in touch')
    && normalized.includes('Office Address: Smart HMS')
    && normalized.includes('Email: info@smarthms.in')
    && normalized.includes('About us')
    && normalized.includes('Hospital Information System Solution')

  return /<title>\s*SmartHMS: Best Hospital Management System \| HMIS \| HIS \| EMR \| LIS \| LIMS\s*<\/title>/i.test(raw)
    && (hasLegacyMetadataSignals || hasCurrentInformationalShell)
    && normalized.includes('Smart Hospital Management System')
    && (
      normalized.includes('Lab Information Management System')
      || normalized.includes('Lab information system')
    )
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractCareerLikeUrlsFromSitemap = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1].trim())
    .filter((url) => /\b(careers?|jobs?|job-openings|join-us|work-with-us)\b/i.test(url))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const raw = String(page?.html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*404 Not Found\s*<\/title>/i.test(raw)
    && /<h1>\s*Not Found\s*<\/h1>/i.test(raw)
    && normalized.includes('The requested URL was not found on this server.')
    && normalized.includes('Server at smarthms.in Port 443')
}

export const createSmartHmsSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SmartHMS verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('SmartHMS homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('SmartHMS homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200) {
      throw new Error('SmartHMS sitemap is no longer publicly reachable')
    }

    const careerLikeUrls = extractCareerLikeUrlsFromSitemap(sitemap.html)
    if (careerLikeUrls.length > 0) {
      throw new Error(`SmartHMS sitemap now advertises career-like URLs: ${careerLikeUrls.join(', ')}`)
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error('SmartHMS careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSmartHmsSolutionsScraper().run(options)

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
