import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pentagonspace'
export const COMPANY = 'Pentagon Space'
export const HOMEPAGE_URL = 'https://pentagonspace.in/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://pentagonspace.in/careers',
  'https://pentagonspace.in/careers/',
  'https://pentagonspace.in/career',
  'https://pentagonspace.in/career/',
  'https://pentagonspace.in/jobs',
  'https://pentagonspace.in/jobs/',
  'https://pentagonspace.in/job',
  'https://pentagonspace.in/job/',
  'https://pentagonspace.in/join-us',
  'https://pentagonspace.in/join-us/',
  'https://pentagonspace.in/openings',
  'https://pentagonspace.in/openings/',
  'https://pentagonspace.in/vacancies',
  'https://pentagonspace.in/vacancies/',
  'https://pentagonspace.in/hiring',
  'https://pentagonspace.in/hiring/',
  'https://pentagonspace.in/work-with-us',
  'https://pentagonspace.in/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|hiring|join-us|joinus|work-with-us)(?:\/|$)/i
const ATS_HOST_PATTERN = /(^|\.)(ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|freshteam\.com|workable\.com|darwinbox\.in|keka\.com|zohorecruit\.com)$/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
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

const isPublicJobsUrl = (url) => {
  if (!url || !/^https?:$/i.test(url.protocol)) return false
  return CAREER_PATH_PATTERN.test(url.pathname) || ATS_HOST_PATTERN.test(url.hostname)
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

  return /<title[^>]*>\s*Pentagon\s*<\/title>/i.test(rawHtml)
    && /href=["']\/about["']/i.test(rawHtml)
    && /href=["']\/branch["']/i.test(rawHtml)
    && /href=["']\/placements["']/i.test(rawHtml)
    && /https:\/\/www\.facebook\.com\/PentagonSpace/i.test(rawHtml)
    && /https:\/\/www\.instagram\.com\/pentagonspace_official\/?/i.test(rawHtml)
    && /https:\/\/x\.com\/pentagon_space/i.test(rawHtml)
    && normalized.includes('trusted by thousands')
    && normalized.includes('where ambition meets direction')
    && normalized.includes('transform your potential through industry-ready programs')
    && normalized.includes('pentagon space is a trusted finishing school and career acceleration platform in bengaluru')
}

export const hasPublicJobsSignal = (html) => {
  const rawHtml = String(html ?? '')

  if (/"@type"\s*:\s*"JobPosting"/i.test(rawHtml)) {
    return true
  }

  for (const match of rawHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (isPublicJobsUrl(absoluteUrl)) {
      return true
    }
  }

  return false
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createPentagonSpaceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Pentagon Space verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Pentagon Space homepage now exposes a public careers or jobs signal')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Pentagon Space verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPentagonSpaceScraper().run(options)

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
