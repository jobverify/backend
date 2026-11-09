import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'deprontoinfotech'
export const COMPANY = 'DePronto InfoTech'
export const HOMEPAGE_URL = 'https://deprontoinfotech.com/'
export const CAREERS_URL = 'https://deprontoinfotech.com/#/careers'
export const APPLICATION_EMAIL = 'hr@depronto.co.uk'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /<title>\s*DePronto Infotech\s*<\/title>/i,
  /<div id="root"><\/div>/i,
  /fonts\.googleapis\.com\/css2\?family=Poppins/i,
  /fonts\.cdnfonts\.com\/css\/metropolis/i,
  /static\/js\/main\.[^"'?#]+\.(?:js|mjs)/i,
]

const BUNDLE_SIGNAL_PATTERNS = [
  /(?:to:"\/home"|#\/home)/i,
  /(?:to:"\/about"|#\/about)/i,
  /(?:to:"\/careers"|#\/careers)/i,
  /(?:to:"\/contact"|#\/contact)/i,
  /Careers at DePronto Infotech/i,
  /Career Opportunities/i,
  /Start your career journey at DePronto/i,
  /hr@depronto\.co\.uk/i,
  /DePronto Infotech/i,
  /Surat\s*\|\s*Mumbai/i,
]

const ROLE_CARD_PATTERN = /cardheading:"([^"]+)",Caedcontain:"([^"]+)"/gi

const EXPECTED_ROLE_TITLES = [
  'Solution Architect',
  'Designer',
  'QA Engineer',
  'Data Engineer',
  'Project Manager',
  'Software Engineer',
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\\n|\\r|\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const decodeJavaScriptString = (value) => {
  const rawValue = String(value ?? '')
  if (!rawValue) return null

  try {
    return normalizeWhitespace(JSON.parse(`"${rawValue}"`))
  } catch {
    return normalizeWhitespace(rawValue)
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,application/javascript,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) =>
  HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.(?:js|mjs))["']/i,
  )

  return match?.[1] ?? null
}

export const hasVerifiedBundleSignal = (bundleText) => {
  const rawBundle = String(bundleText ?? '')
  return BUNDLE_SIGNAL_PATTERNS.every((pattern) => pattern.test(rawBundle))
    && (rawBundle.match(ROLE_CARD_PATTERN) || []).length >= EXPECTED_ROLE_TITLES.length
}

export const extractCareerCards = (bundleText) => {
  const uniqueCards = new Map()
  const rawBundle = String(bundleText ?? '')

  for (const match of rawBundle.matchAll(ROLE_CARD_PATTERN)) {
    const title = decodeJavaScriptString(match[1])
    const jobDescription = decodeJavaScriptString(match[2])

    if (!title || !jobDescription || uniqueCards.has(title)) continue
    uniqueCards.set(title, { title, jobDescription })
  }

  return EXPECTED_ROLE_TITLES
    .map((title) => uniqueCards.get(title))
    .filter(Boolean)
}

const hasExpectedRoleCards = (cards) =>
  cards.length === EXPECTED_ROLE_TITLES.length
  && EXPECTED_ROLE_TITLES.every((title) => cards.some((card) => card.title === title))

const buildJobFromCard = (card) => ({
  title: card.title,
  company: COMPANY,
  department: null,
  location: 'India',
  city: null,
  country: 'India',
  jobId: `${SOURCE}-${slugify(card.title)}`,
  requisitionId: null,
  sourceUrl: CAREERS_URL,
  applyUrl: APPLICATION_URL,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: card.jobDescription,
  publicExperienceChecked: true,
  remoteStatus: null,
})

export const createDeProntoInfoTechScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText, now: overrideNow, signal } = {}) {
    const rawFetchText = overrideFetchText || fetchText
    const fetchImpl = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchText(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const homepageHtml = await fetchImpl(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('DePronto InfoTech verified official homepage no longer matches the known first-party surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepageHtml)
    if (!bundleAssetPath) {
      throw new Error('DePronto InfoTech homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchImpl(bundleUrl)

    if (!hasVerifiedBundleSignal(bundleText)) {
      throw new Error('DePronto InfoTech verified careers bundle no longer matches the known first-party jobs surface')
    }

    const cards = extractCareerCards(bundleText)
    if (!hasExpectedRoleCards(cards)) {
      throw new Error('DePronto InfoTech public role cards changed materially')
    }

    const scrapedAt = (overrideNow || now)()

    return cards.map((card) => ({
      ...buildJobFromCard(card),
      source: SOURCE,
      link: APPLICATION_URL,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createDeProntoInfoTechScraper(options).run(options)

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
