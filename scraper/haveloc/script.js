import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'haveloc'
export const COMPANY = 'Haveloc'
export const HOMEPAGE_URL = 'https://haveloc.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://haveloc.com/careers',
  'https://haveloc.com/careers/',
  'https://haveloc.com/career',
  'https://haveloc.com/career/',
  'https://haveloc.com/jobs',
  'https://haveloc.com/jobs/',
  'https://haveloc.com/job',
  'https://haveloc.com/job/',
  'https://haveloc.com/join-us',
  'https://haveloc.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'haveloc.com' || hostname.endsWith('.haveloc.com')
}

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
  const hasResumeProductLink = /href="https:\/\/(?:jobsurf|resume)\.haveloc\.com\/?"/i.test(rawHtml)

  const hasLegacyHomepageSignal = /<title[^>]*>\s*Haveloc \| Placement Automation Software\s*<\/title>/i.test(rawHtml)
    && /href="https:\/\/placements\.haveloc\.com"/i.test(rawHtml)
    && /href="https:\/\/insider\.haveloc\.com"/i.test(rawHtml)
    && hasResumeProductLink
    && /href="\/about\.html"/i.test(rawHtml)
    && /management@haveloc\.com/i.test(rawHtml)
    && normalized.includes('finally all your job postings students in one place')
    && normalized.includes('from crazy ideas to code the haveloc story')

  const hasCurrentAppShellSignal = /<title[^>]*>\s*Haveloc\s+—\s+Placement Operations Software\s*<\/title>/i.test(rawHtml)
    && /content="Haveloc\s+—\s+the placement system for campuses and recruiters\. From job posts to offer letters\."/i.test(rawHtml)
    && /<script[^>]+src="\/assets\/index-[^"]+\.js"/i.test(rawHtml)
    && /<div[^>]+id="root"[^>]*><\/div>/i.test(rawHtml)

  return hasLegacyHomepageSignal || hasCurrentAppShellSignal
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404
  || (Number(page?.status) === 200 && hasOfficialHomepageSignal(page?.html))

export const createHavelocScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Haveloc verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Haveloc homepage now exposes a first-party careers or jobs link')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Haveloc verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHavelocScraper().run(options)

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
