import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sentientscripts'
export const COMPANY = 'SENTIENT SCRIPTS PVT. LTD.'
export const HOMEPAGE_URL = 'https://www.sentientscripts.com/'
export const SITEMAP_URL = 'https://www.sentientscripts.com/sitemap.xml'
export const PAGES_SITEMAP_URL = 'https://www.sentientscripts.com/pages-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.sentientscripts.com/careers',
  'https://www.sentientscripts.com/career',
  'https://www.sentientscripts.com/jobs',
  'https://www.sentientscripts.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_LINKEDIN_URL = 'https://www.linkedin.com/company/sentient-scripts/'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'www.sentientscripts.com' || hostname === 'sentientscripts.com'
  } catch {
    return false
  }
}

const isFirstPartyHomepageUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl.href)) {
    return false
  }

  return absoluteUrl.pathname === '/'
    && !absoluteUrl.search
    && !absoluteUrl.hash
}

const extractXmlLocUrls = (xml) => [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
  .map((match) => match[1].trim())
  .filter(Boolean)

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('sentient scripts pvt. ltd.')
    && normalized.includes('info@sentientscripts.com')
    && normalized.includes('thiruvananthapuram')
    && page.includes(OFFICIAL_LINKEDIN_URL)
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl.href)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedSitemapIndex = (xml) => {
  const urls = extractXmlLocUrls(xml)

  return urls.includes(PAGES_SITEMAP_URL)
    && urls.every((url) => !CAREER_PATH_PATTERN.test(new URL(url).pathname))
}

export const hasVerifiedPagesSitemap = (xml) => {
  const urls = extractXmlLocUrls(xml)

  return urls.length > 0
    && urls.some((url) => isFirstPartyHomepageUrl(url))
    && urls.every((url) => !CAREER_PATH_PATTERN.test(new URL(url).pathname))
}

export const isVerifiedMissingCareersRoute = (page = {}) =>
  isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && Number(page.status) === 404
  && !hasPublicJobsSignal(page.html)

export const createSentientScriptsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Sentient Scripts verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Sentient Scripts homepage now appears to expose a public jobs surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Sentient Scripts homepage now exposes a first-party careers or jobs link')
    }

    const sitemapIndex = await fetchPage(SITEMAP_URL)
    if (sitemapIndex.status !== 200 || !hasVerifiedSitemapIndex(sitemapIndex.html)) {
      throw new Error('Sentient Scripts verified sitemap index no longer matches the known public surface')
    }

    const pagesSitemap = await fetchPage(PAGES_SITEMAP_URL)
    if (pagesSitemap.status !== 200 || !hasVerifiedPagesSitemap(pagesSitemap.html)) {
      throw new Error('Sentient Scripts verified pages sitemap no longer matches the known public surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error('Sentient Scripts careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSentientScriptsScraper().run(options)

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
