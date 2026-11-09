import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'smarthealthglobaltechnologies'
export const COMPANY = 'Smart Health Global Technologies'
export const LEGACY_HOME_URL = 'https://smarthealthglobal.in/'
export const HOMEPAGE_URL = 'https://shgtechnologies.com/'
export const ABOUT_URL = 'https://shgtechnologies.com/about-us'
export const SITEMAP_URL = 'https://shgtechnologies.com/sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://shgtechnologies.com/careers',
  'https://shgtechnologies.com/career',
  'https://shgtechnologies.com/jobs',
  'https://shgtechnologies.com/job-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_URL_PATTERN = /\b(careers?|jobs?|hiring|openings?|vacanc(?:y|ies)|work-with-us|join-us)\b/i
const PUBLIC_JOB_SIGNAL_PATTERN =
  /\b(current openings?|job openings?|career opportunities?|open positions?|vacanc(?:y|ies)|we are hiring|apply now)\b|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|smartrecruiters|workdayjobs|myworkdayjobs|icims\.com|jobvite|\/careers\/[a-z0-9-]+/i
const MISSING_ROUTE_PATTERN = /(?:^|\b)not found\b.*\b404\b|\b404\b.*\bnot found\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasLegacyBridgeSignal = (html = '') => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw).toLowerCase()

  return normalized.includes('smart health global')
    && normalized.includes('back to shg technologies')
    && /href=["']https:\/\/shgtechnologies\.com\/?["']/i.test(raw)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw).toLowerCase()

  return normalized.includes('shg technologies - home')
    && /href=["']https:\/\/shgtechnologies\.com\/about-us["']/i.test(raw)
    && /href=["']https:\/\/shgtechnologies\.com\/products\/smart-vision-glasses["']/i.test(raw)
}

export const hasOfficialAboutSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('why we started')
    && normalized.includes('at shg technologies')
    && normalized.includes('support@shgtechnologies.com')
    && normalized.includes('shg technologies pvt. ltd.')
    && normalized.includes('brigade rubix')
}

export const extractCareerLikeUrlsFromSitemap = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1].trim())
    .filter((url) => CAREER_LIKE_URL_PATTERN.test(url))

export const isMissingCareerRoute = (html = '') =>
  MISSING_ROUTE_PATTERN.test(normalizeWhitespace(html))

export const hasPublicJobSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERN.test(normalizeWhitespace(html))

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

const defaultFetchText = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return response.text()
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const createSmartHealthGlobalTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const legacyHtml = await fetchText(LEGACY_HOME_URL)
    if (!hasLegacyBridgeSignal(legacyHtml)) {
      throw new Error('Smart Health Global legacy smart health global bridge no longer matches the verified first-party surface')
    }

    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SHG Technologies homepage no longer matches the verified official homepage')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('SHG Technologies about page no longer matches the verified official company surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromSitemap(sitemapXml)
    if (careerLikeUrls.length > 0) {
      throw new Error(`SHG Technologies sitemap now advertises career-like URLs: ${careerLikeUrls.join(', ')}`)
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)

      if (hasPublicJobSignal(routeHtml) && !isMissingCareerRoute(routeHtml)) {
        throw new Error(`SHG Technologies public careers route changed: ${routeUrl}`)
      }

      if (!isMissingCareerRoute(routeHtml)) {
        throw new Error(`SHG Technologies public careers route no longer returns the verified 404 shell: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) =>
  createSmartHealthGlobalTechnologiesScraper().run(options)

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
