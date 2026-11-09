import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'g10x'
export const COMPANY = 'G10X'
export const HOMEPAGE_URL = 'https://www.g10x.com/'
export const CAREERS_URL = 'https://www.g10x.com/careers'
export const JOBS_URL = 'https://www.g10x.com/jobs'
export const COMPANY_DOMAIN = 'g10x.com'
export const VERIFIED_ON = '2026-10-03'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.g10x.com/, https://www.g10x.com/careers, and https://www.g10x.com/jobs remained G10X\'s live first-party careers surface. The jobs page still shows 0 job openings for you, with no job-detail links. Its new /job-apply link is a general Share your profile form for future opportunities. The related legacy openings routes under /career, /join-us, /current-openings, /openings, and /work-with-us still returned the standard Webflow 404 shell.'
export const MISSING_ROUTE_URLS = [
  'https://www.g10x.com/career',
  'https://www.g10x.com/join-us',
  'https://www.g10x.com/current-openings',
  'https://www.g10x.com/openings',
  'https://www.g10x.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&copy;/gi, '©')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

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

const extractLinks = (html) => [
  ...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi),
].map((match) => match[1])

const normalizeUrl = (href, baseUrl) => {
  try {
    return new URL(href, baseUrl)
  } catch {
    return null
  }
}

const extractOpeningCount = (html) => {
  const match = normalizeVisibleText(html).match(/\b(\d+)\s+job openings?\s+for you\b/i)
  return match ? Number.parseInt(match[1], 10) : null
}

const extractJobDetailLinks = (html) => {
  const baseUrl = new URL(JOBS_URL)

  return extractLinks(html)
    .map((href) => normalizeUrl(href, JOBS_URL))
    .filter(Boolean)
    .filter((url) => url.origin === baseUrl.origin && /^\/jobs\/.+/i.test(url.pathname))
    .map((url) => url.toString())
}

const hasVerifiedGeneralApplication = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  return /<a\b[^>]*id=["']proactively-apply-btn["'][^>]*href=["']\/job-apply["'][^>]*>/i.test(page)
    && text.includes("don't see a matching role?")
    && text.includes('share your profile for future opportunities')
    && text.includes('share your profile')
}

const extractApplyLinks = (html) => extractLinks(html)
  .map((href) => normalizeUrl(href, JOBS_URL))
  .filter(Boolean)
  .filter((url) => /(^mailto:)|apply|greenhouse|lever|workday|ashby|recruitee|freshteam|teamtailor|zohorecruit|optimhire|linkedin\.com\/jobs\/view/i.test(url.toString()))
  .filter((url) => !(url.origin === new URL(JOBS_URL).origin
    && url.pathname === '/job-apply'
    && hasVerifiedGeneralApplication(html)))
  .map((url) => url.toString())

export const hasVerifiedCareersLink = (html) =>
  /href=["']\/careers["']/i.test(String(html ?? ''))

export const hasVerifiedJobsLink = (html) =>
  /href=["']\/jobs["']/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*G10X\s*\|\s*End-to-end digital and AI solutions\s*<\/title>/i.test(page)
    && text.includes('end-to-end digital and ai solutions')
    && text.includes('driven by customer obsession')
    && /copyright[\s\S]{0,40}?g10x\s+\|\s+all rights reserved/i.test(normalizeVisibleText(page))
    && hasVerifiedCareersLink(page)
    && /href=["']\/who-we-are["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  const normalizedPage = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && normalizedPage.includes('join g10x, a great place to work certified')
    && text.includes("if you're ready to grow your skills")
    && text.includes('why g10x')
    && text.includes('grow with purpose')
    && text.includes('work with global brands')
    && text.includes('find your place at g10x')
    && hasVerifiedJobsLink(page)
}

export const hasOfficialJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  const normalizedPage = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Jobs\s*<\/title>/i.test(page)
    && normalizedPage.includes('explore opportunities that challenge you, support you, and help you build a career that lasts.')
    && text.includes('your career starts here')
    && text.includes('our job offerings')
    && /\b\d+\s+job openings?\s+for you\b/i.test(text)
}

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return status === 404
    && /<title>\s*404\s*-\s*Page not found\s*<\/title>/i.test(page)
    && text.includes('404')
    && text.includes('page not found')
    && text.includes("the page you are looking for doesn't exist or has been moved")
}

export const extractJobs = (html) => {
  if (!hasOfficialJobsSignal(html)) {
    throw new Error('G10X jobs page no longer matches the verified official empty-jobs surface')
  }

  const openingCount = extractOpeningCount(html)
  if (openingCount == null) {
    throw new Error('G10X jobs page no longer exposes the verified opening-count heading')
  }

  if (openingCount !== 0) {
    throw new Error('G10X public openings changed materially')
  }

  if (extractJobDetailLinks(html).length > 0 || extractApplyLinks(html).length > 0) {
    throw new Error('G10X public openings changed materially')
  }

  return []
}

export const createG10XScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('G10X official homepage no longer matches the verified public surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('G10X homepage no longer links to the verified careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('G10X careers page no longer matches the verified public surface')
    }

    if (!hasVerifiedJobsLink(careersPage.html)) {
      throw new Error('G10X careers page no longer links to the verified jobs page')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (jobsPage.status !== 200 || !hasOfficialJobsSignal(jobsPage.html)) {
      throw new Error('G10X jobs page no longer matches the verified official empty-jobs surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error(`G10X missing-route validation failed for ${missingRouteUrl}`)
      }
    }

    const jobs = extractJobs(jobsPage.html)
    const scrapedAt = (overrideNow || now)()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: JOBS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createG10XScraper().run(options)

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
