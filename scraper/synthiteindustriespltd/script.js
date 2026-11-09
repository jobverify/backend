import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'synthiteindustriespltd'
export const COMPANY = 'Synthite Industries (P) Ltd'
export const HOMEPAGE_URL = 'https://www.synthite.com/'
export const CAREERS_URL = 'https://www.synthite.com/careers/'
export const CAREER_OPPORTUNITIES_URL = 'https://www.synthite.com/careers/career-opportunities/'
export const CAREERS_EMAIL = 'careers@synthite.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_LINK_PATTERNS = [
  /href=["'][^"']*(?:greenhouse|lever|ashbyhq|workdayjobs|myworkdayjobs|smartrecruiters|jobvite|darwinbox|linkedin\.com\/jobs)[^"']*["']/i,
  /href=["'][^"']*(?:\/jobs\/|\/job\/|\/careers\/jobs\/|\/openings\/|\/positions\/)[^"']*["']/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjob id\b/i,
  /\brequisition\b/i,
  /\bview details\b/i,
]

const HOMEPAGE_PRIMARY_SIGNALS = [
  "the world's largest producer of value-added spices",
  "the world's leading producer of botanical extracts",
]

const HOMEPAGE_SUPPORTING_SIGNALS = [
  '50+ years. 90+ countries. 1 mission.',
  'built on experience engineered for impact',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return HOMEPAGE_PRIMARY_SIGNALS.some((signal) => normalized.includes(signal))
    && HOMEPAGE_SUPPORTING_SIGNALS.some((signal) => normalized.includes(signal))
    && /href=["'](?:https:\/\/www\.synthite\.com)?\/careers\/["']/i.test(String(html ?? ''))
}

export const hasOfficialCareersLandingSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('build your career with a global leader in natural ingredients innovation')
    && normalized.includes('explore current openings')
    && normalized.includes('employee experience')
    && /href=["'](?:https:\/\/www\.synthite\.com)?\/careers\/career-opportunities\/["']/i.test(String(html ?? ''))
}

export const hasOfficialCareerOpportunitiesSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('explore career opportunities at synthite across research, manufacturing, business development, and leadership roles')
    && normalized.includes('view current openings')
    && normalized.includes('our opportunity spectrum includes')
    && normalized.includes('application access:')
    && normalized.includes(CAREERS_EMAIL)
}

export const extractCareerContact = (html) => {
  const emailMatch = decodeHtmlEntities(String(html ?? '')).match(/\bcareers@synthite\.com\b/i)

  return {
    email: emailMatch?.[0]?.toLowerCase() || null,
  }
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_LINK_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createSynthiteIndustriesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Synthite verified official homepage no longer matches the trusted first-party surface')
    }

    const careersLandingHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Synthite verified careers landing no longer matches the trusted first-party surface')
    }

    const careerOpportunitiesHtml = await fetchText(CAREER_OPPORTUNITIES_URL)
    if (!hasOfficialCareerOpportunitiesSignal(careerOpportunitiesHtml)) {
      throw new Error('Synthite verified career-opportunities page no longer matches the trusted first-party surface')
    }

    const contact = extractCareerContact(careerOpportunitiesHtml)
    if (contact.email !== CAREERS_EMAIL) {
      throw new Error('Synthite verified career-opportunities page no longer exposes the trusted contact handoff')
    }

    if (hasPublicJobBoardSignal(careerOpportunitiesHtml)) {
      throw new Error('Synthite career-opportunities page now appears to expose a concrete public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSynthiteIndustriesScraper().run(options)

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
