import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aspireeventsandexhibitions'
export const COMPANY = 'Aspire Events & Exhibitions'
export const HOMEPAGE_URL = 'https://www.aspireevents.in/'
export const SITEMAP_URL = 'https://aspireevents.in/sitemap.xml'
export const CHECKED_ROUTE_URLS = [
  'https://www.aspireevents.in/careers',
  'https://www.aspireevents.in/career',
  'https://www.aspireevents.in/jobs',
  'https://www.aspireevents.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeXml = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const titleOf = (html) =>
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim() || null

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
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Aspire Events (?:&amp;|&) Exhibitions\s*\|\s*Leading Exhibition (?:&amp;|&) Event Management Company in South India\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Aspire Events (?:&amp;|&) Exhibitions["']/i.test(rawHtml)
    && normalized === 'Aspire Events & Exhibitions | Leading Exhibition & Event Management Company in South India'
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const buildShellSignature = (html) => JSON.stringify({
  title: titleOf(html),
  body: normalizeWhitespace(html),
})

export const routeMatchesVerifiedShell = (html, homepageSignature) =>
  buildShellSignature(html) === homepageSignature
  && hasOfficialHomepageSignal(html)
  && !hasPublicJobsSignal(html)

export const sitemapLacksCareerRoutes = (xml) => {
  const normalized = normalizeXml(xml)
  if (!normalized.includes('https://aspireevents.in/')) {
    return false
  }

  const locMatches = Array.from(
    normalized.matchAll(/<loc>([^<]+)<\/loc>/gi),
    (match) => match[1],
  )

  return locMatches.length > 0 && locMatches.every((loc) => {
    try {
      return !CAREER_PATH_PATTERN.test(new URL(loc).pathname)
    } catch {
      return false
    }
  })
}

export const createAspireEventsAndExhibitionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Aspire Events & Exhibitions verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Aspire Events & Exhibitions homepage now appears to expose public jobs')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !sitemapLacksCareerRoutes(sitemap.html)) {
      throw new Error('Aspire Events & Exhibitions verified sitemap no longer matches the no-public-careers surface')
    }

    const homepageSignature = buildShellSignature(homepage.html)

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !routeMatchesVerifiedShell(routePage.html, homepageSignature)) {
        throw new Error('Aspire Events & Exhibitions checked first-party route changed materially or now exposes public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAspireEventsAndExhibitionsScraper().run(options)

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
