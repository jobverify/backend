import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lapaelectricprivatelimited'
export const COMPANY = 'Lapa Electric Private Limited'
export const HOMEPAGE_URL = 'https://lapaelectric.com/'
export const CAREERS_URL = 'https://lapaelectric.com/lapa-careers/'
export const CAREER_SITEMAP_URL = 'https://lapaelectric.com/career-sitemap.xml'
export const VERIFIED_CAREER_POST_URLS = [
  'https://lapaelectric.com/career/we-dreamt-of-a-scenario-where-innovation-is-human-centric/',
  'https://lapaelectric.com/career/we-are-passionate-engineers-driven-to-bring-the-most-futuristic-ideas-to-reality/',
  'https://lapaelectric.com/career/lapa-electric-is-where-art-concept-meets-engineering/',
  'https://lapaelectric.com/career/join-a-team-of-like-minded-thinkers-who-turn-dreams-into-reality/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_SIGNALS = [
  'lapa electric | futuristic, premium electric mobility crafted in india',
  'travel beyond your senses',
  'carbon fiber: stronger than your willpower, lighter than your excuses.',
]

const CAREERS_REQUIRED_SIGNALS = [
  'lapa-careers - lapa',
  'careers',
  'work with us:',
  'design and engineering as we are',
  'see openings',
  'your details',
  'what can we help you with?',
  'interest in representation\\distribution',
  'product information',
  'careers',
  'other',
  '9480886072',
  '9902949596',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjob title\b/i,
  /\bresponsibilit(?:y|ies)\b/i,
  /\bqualification(?:s)?\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/[’‘]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) => {
  const html = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return { status: 200, url, html }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return HOMEPAGE_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*lapa electric\s*\|\s*futuristic,\s*premium electric mobility crafted in india\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']lapa["']/i.test(rawHtml)
    && /href=["']https:\/\/lapaelectric\.com\/lapa-careers\/["']/i.test(rawHtml)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return CAREERS_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*lapa-careers\s*-\s*lapa\s*<\/title>/i.test(rawHtml)
    && /<form[^>]+name=["']careers page form["']/i.test(rawHtml)
    && /<select[^>]+name=["']form_fields\[field_76448a5\]["']/i.test(rawHtml)
    && /<option value=["']Careers\s*["']>Careers\s*<\/option>/i.test(rawHtml)
    && /mailto:info@lapaelectric\.com/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractCareerSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>(https:\/\/lapaelectric\.com\/career\/[^<]+)<\/loc>/gi)]
    .map((match) => match[1])

export const hasVerifiedNarrativeCareerSitemap = (xml) => {
  const urls = extractCareerSitemapUrls(xml)

  if (urls.length !== VERIFIED_CAREER_POST_URLS.length) {
    return false
  }

  const actual = new Set(urls)
  return VERIFIED_CAREER_POST_URLS.every((url) => actual.has(url))
}

export const createLapaElectricPrivateLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Lapa Electric Private Limited verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Lapa Electric Private Limited homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Lapa Electric Private Limited verified official careers surface no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Lapa Electric Private Limited careers page now appears to expose a public jobs surface')
    }

    const careerSitemap = await fetchPage(CAREER_SITEMAP_URL)

    if (careerSitemap.status !== 200 || !hasVerifiedNarrativeCareerSitemap(careerSitemap.html)) {
      throw new Error('Lapa Electric Private Limited career sitemap changed materially or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createLapaElectricPrivateLimitedScraper().run(options)

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
