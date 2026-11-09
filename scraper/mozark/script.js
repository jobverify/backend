import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mozark'
export const COMPANY = 'Mozark'
export const HOMEPAGE_URL = 'https://www.mozark.ai/'
export const SITEMAP_INDEX_URL = 'https://www.mozark.ai/sitemap.xml'
export const PAGES_SITEMAP_URL = 'https://www.mozark.ai/pages-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.mozark.ai/careers',
  'https://www.mozark.ai/careers/',
  'https://www.mozark.ai/career',
  'https://www.mozark.ai/career/',
  'https://www.mozark.ai/jobs',
  'https://www.mozark.ai/jobs/',
  'https://www.mozark.ai/join-us',
  'https://www.mozark.ai/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
  /linkedin\.com\/jobs\//i,
]

const CAREER_LIKE_URL_PATTERN =
  /\/(?:career|careers|job|jobs|opening|openings|join-us)(?:[/?#-]|$)/i

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
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
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Mozark\.ai\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Digital experience intelligence across user, application and network layers\./i.test(rawHtml)
    && normalized.includes('digital experience assurance')
    && normalized.includes('experience is all')
    && normalized.includes('great user experience requires great apps and great networks. mozark assures that.')
    && normalized.includes('ready to elevate your digital experience')
    && normalized.includes('join hundreds of enterprises using mozark ai')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractPagesSitemapUrl = (xml) =>
  String(xml ?? '').match(/<loc>(https:\/\/www\.mozark\.ai\/pages-sitemap\.xml)<\/loc>/i)?.[1] ?? null

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
  return matches.some((match) => CAREER_LIKE_URL_PATTERN.test(match[1] ?? ''))
}

export const isVerifiedMissingCareersRoute = (page = {}) =>
  Number(page?.status) === 404
  && (
    /<title>\s*404 Error:\s*Page Not Found\s*<\/title>/i.test(String(page?.html ?? ''))
    || /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i.test(String(page?.html ?? ''))
  )
  && normalizeText(page?.html).includes('mozark.ai')
  && !hasPublicJobsSignal(page?.html)

export const createMozarkScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mozark verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Mozark homepage now appears to expose a public jobs surface')
    }

    for (const sitemapUrl of [SITEMAP_INDEX_URL, PAGES_SITEMAP_URL]) {
      const sitemapPage = await fetchPage(sitemapUrl)
      if (!isVerifiedMissingCareersRoute(sitemapPage)) {
        if (hasPublicJobsSignal(sitemapPage.html)) {
          throw new Error('Mozark sitemap endpoints changed materially or now expose public jobs')
        }

        throw new Error(`Mozark verified sitemap endpoint no longer matches the missing public surface: ${sitemapPage.url || sitemapUrl}`)
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingCareersRoute(routePage)) {
        if (hasPublicJobsSignal(routePage.html)) {
          throw new Error('Mozark careers routes changed materially or now expose public jobs')
        }

        throw new Error(`Mozark verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMozarkScraper().run(options)

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
