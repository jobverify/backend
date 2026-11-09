import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'morphlelabs'
export const COMPANY = 'Morphle Labs'
export const HOMEPAGE_URL = 'https://morphlelabs.com/'
export const ABOUT_URL = 'https://morphlelabs.com/about-us'
export const SITEMAP_URL = 'https://morphlelabs.com/sitemap.xml'
export const LEGACY_EVALUATION_URL = 'https://morphlelabs.com/mech-online-test'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://morphlelabs.com/careers',
  'https://morphlelabs.com/careers/',
  'https://morphlelabs.com/career',
  'https://morphlelabs.com/career/',
  'https://morphlelabs.com/jobs',
  'https://morphlelabs.com/jobs/',
  'https://morphlelabs.com/join-us',
  'https://morphlelabs.com/join-us/',
  'https://morphlelabs.com/work-with-us',
  'https://morphlelabs.com/work-with-us/',
  'https://morphlelabs.com/openings',
  'https://morphlelabs.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
  /teamtailor/i,
  /workable/i,
  /icims/i,
  /successfactors/i,
]

const SITEMAP_CAREER_LIKE_URL_PATTERN =
  /(?:\/(?:careers?|jobs?|job-openings?|openings?|vacanc(?:y|ies)|join-us|work-with-us)(?:[/?#]|$)|boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|darwinbox|zohorecruit|teamtailor|workable|icims|successfactors)/i

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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const canonicalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return ''
  }
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

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*[^<]*Morphle Labs Inc\.[^<]*Robotic Microtome[^<]*Whole Slide Image Scanner[^<]*<\/title>/i.test(rawHtml)
    && normalized.includes('Solving bottlenecks in Cancer Diagnostics')
    && normalized.includes("World's first, High Throughput Robotic Microtome")
    && normalized.includes('Digital Pathology')
    && /href=["']\/about-us\/?["']/i.test(rawHtml)
    && /href=["']\/demo["']/i.test(rawHtml)
}

export const hasOfficialAboutHiringSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Meet the team')
    && normalized.includes('Backed by Great Investors')
    && normalized.includes('Our biggest advantage.. 100+ misfits, led by')
    && normalized.includes('We are looking for people to join us on R&D and Growth teams.')
    && normalized.includes('hr@morphlelabs.com')
}

const extractSitemapUrls = (xml = '') =>
  Array.from(String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim())

export const sitemapHasUnexpectedCareerLikeUrl = (xml = '') =>
  extractSitemapUrls(xml).some((url) => SITEMAP_CAREER_LIKE_URL_PATTERN.test(url))

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasStaleLegacyEvaluationSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Mech Online Test\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Welcome to Online evaluation for Mechanical Design Engineering role @ Morphle Labs')
    && normalized.includes('The test has 1 hour window from 2pm-3pm Sunday, 7th Nov, 2021')
    && normalized.includes('The test has 3 questions.')
}

export const isVerifiedMissingPublicJobRoute = (page = {}) =>
  Number(page?.status) === 404 && !hasPublicJobsSignal(page?.html)

export const isVerifiedSafeLegacyEvaluationRoute = (page = {}) => {
  if (isVerifiedMissingPublicJobRoute(page)) {
    return true
  }

  const finalUrl = canonicalizeUrl(page?.url)

  if (
    Number(page?.status) === 200
    && finalUrl === HOMEPAGE_URL
    && hasOfficialHomepageSignal(page?.html)
    && !hasPublicJobsSignal(page?.html)
  ) {
    return true
  }

  return Number(page?.status) === 200
    && finalUrl === LEGACY_EVALUATION_URL
    && hasStaleLegacyEvaluationSignal(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createMorphleLabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Morphle Labs verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Morphle Labs homepage now appears to expose public jobs')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutHiringSignal(aboutPage.html)) {
      throw new Error('Morphle Labs verified about page hiring contact no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(aboutPage.html)) {
      throw new Error('Morphle Labs about page now appears to expose public jobs')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasUnexpectedCareerLikeUrl(sitemap.html)) {
      throw new Error('Morphle Labs verified sitemap no longer matches the zero-public-jobs surface')
    }

    const legacyEvaluationPage = await fetchPage(LEGACY_EVALUATION_URL)
    if (!isVerifiedSafeLegacyEvaluationRoute(legacyEvaluationPage)) {
      throw new Error('Morphle Labs legacy evaluation route no longer matches the trusted stale public surface')
    }

    for (const routeUrl of PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`Morphle Labs missing-public-jobs route ${routeUrl} no longer matches the verified empty surface`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMorphleLabsScraper().run(options)

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
