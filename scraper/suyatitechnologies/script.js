import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'suyatitechnologies'
export const COMPANY = 'Suyati Technologies'
export const HOMEPAGE_URL = 'https://suyati.com/'
export const HOMEPAGE_REDIRECT_URL = 'https://milestone.tech/'
export const ACQUISITION_HISTORY_URL = 'https://milestone.tech/company/corporate-overview/history/'
export const PARENT_CAREERS_URL = 'https://milestone.tech/careers/join-the-team/'
export const PARENT_OPEN_POSITIONS_URL =
  'https://phf.tbe.taleo.net/phf01/ats/careers/v2/searchResults?cws=37&org=COVESTIC2'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  const input = String(value ?? '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return input.replace(/\/$/, '')
  }
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
    finalUrl: response.url,
    url: response.url,
    html: await response.text(),
  }
}

export const isExpectedHomepageRedirectUrl = (value) =>
  normalizeComparableUrl(value) === normalizeComparableUrl(HOMEPAGE_REDIRECT_URL)

export const hasParentHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*IT Services Company\s*\|\s*Milestone Technologies\s*<\/title>/i.test(rawHtml)
    && normalized.includes('over 26 years of it service excellence')
    && normalized.includes('milestone works with the world')
    && normalized.includes('join us view open positions')
}

export const hasAcquisitionHistorySignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*History\s*\|\s*Milestone Technologies\s*-\s*IT Services Company\s*<\/title>/i.test(rawHtml)
    && normalized.includes('2024')
    && normalized.includes('milestone technologies, inc. acquires suyati technologies')
}

export const hasParentCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Join the Team\s*\|\s*Milestone Technologies\s*<\/title>/i.test(rawHtml)
    && normalized.includes('join the milestone team')
    && normalized.includes('welcome to milestone technologies')
    && normalized.includes('view full-time positions')
    && /phf\.tbe\.taleo\.net/i.test(rawHtml)
}

export const hasParentOpenPositionsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Career Center\s*<\/title>/i.test(rawHtml)
    && normalized.includes('positions matched')
    && normalized.includes('milestone technologies, inc.')
    && normalized.includes('apply')
}

export const hasBrandSpecificOpeningsSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /\bsuyati technologies\b/i.test(normalized)
    || /\bsuyati\b.{0,80}\b(open(?:ings)?|jobs?|positions?)\b/i.test(normalized)
    || /\b(open(?:ings)?|jobs?|positions?)\b.{0,80}\bsuyati\b/i.test(normalized)
}

export const createSuyatiTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const finalHomepageUrl = homepage?.finalUrl || homepage?.url || HOMEPAGE_URL

    if (
      homepage.status !== 200
      || !isExpectedHomepageRedirectUrl(finalHomepageUrl)
      || !hasParentHomepageSignal(homepage.html)
    ) {
      throw new Error(
        'Suyati Technologies official homepage handoff no longer matches the verified Milestone public surface',
      )
    }

    const acquisitionHistory = await fetchPage(ACQUISITION_HISTORY_URL)
    if (
      acquisitionHistory.status !== 200
      || !hasAcquisitionHistorySignal(acquisitionHistory.html)
    ) {
      throw new Error(
        'Suyati Technologies acquisition history page no longer matches the verified Milestone public surface',
      )
    }

    const parentCareersPage = await fetchPage(PARENT_CAREERS_URL)
    if (
      parentCareersPage.status !== 200
      || !hasParentCareersSignal(parentCareersPage.html)
    ) {
      throw new Error(
        'Suyati Technologies parent careers page no longer matches the verified Milestone public surface',
      )
    }

    if (hasBrandSpecificOpeningsSignal(parentCareersPage.html)) {
      throw new Error('Suyati Technologies parent careers page now appears to expose brand-specific openings')
    }

    const parentOpenPositionsPage = await fetchPage(PARENT_OPEN_POSITIONS_URL)
    if (
      parentOpenPositionsPage.status !== 200
      || !hasParentOpenPositionsSignal(parentOpenPositionsPage.html)
    ) {
      throw new Error(
        'Suyati Technologies parent open positions page no longer matches the verified Milestone public surface',
      )
    }

    if (hasBrandSpecificOpeningsSignal(parentOpenPositionsPage.html)) {
      throw new Error('Suyati Technologies parent open positions page now appears to expose brand-specific openings')
    }

    return []
  },
})

export const run = async (options = {}) => createSuyatiTechnologiesScraper().run(options)

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
