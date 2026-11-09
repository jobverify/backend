import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SENECA_GLOBAL_IT_SERVICES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SENECA_GLOBAL_IT_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractMetaContent = (html = '', property) => normalizeWhitespace(
  String(html ?? '').match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1],
)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*India Careers\s*-\s*Seneca Global\s*<\/title>/i.test(page)
    && /India-Based Career Opportunities/i.test(page)
    && /Open positions/i.test(page)
    && /india-careers\//i.test(page)
}

export const extractJobCards = (html = '') => {
  const cards = []
  const seenDetailUrls = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=(["'])(https:\/\/www\.senecaglobal\.com\/india-careers\/[^"'<>]+\/)\1[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const anchorHtml = match[0]
    const detailUrl = normalizeWhitespace(match[2])
    const title = normalizeWhitespace(
      anchorHtml.match(/\btitle=(["'])(.*?)\1/i)?.[2]
      || match[3],
    )

    if (!detailUrl || !title || /^read more$/i.test(title) || seenDetailUrls.has(detailUrl)) {
      continue
    }

    seenDetailUrls.add(detailUrl)
    cards.push({
      title,
      detailUrl,
    })
  }

  return cards
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*[^<]+-\s*SenecaGlobal\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.senecaglobal\.com\/india-careers\//i.test(page)
    && /og:description/i.test(page)
}

export const extractJobFromDetailHtml = (html = '', card = {}, { scrapedAt } = {}) => {
  const detailUrl = normalizeWhitespace(
    String(html ?? '').match(/<link rel="canonical" href="([^"]+)"/i)?.[1],
  ) || card.detailUrl
  const title = normalizeWhitespace(
    String(html ?? '').match(/<title>\s*([^<]+?)\s*-\s*SenecaGlobal\s*<\/title>/i)?.[1],
  ) || card.title
  const description = extractMetaContent(html, 'og:description')
  const jobId = detailUrl?.split('/').filter(Boolean).at(-1) || null

  if (!detailUrl || !title || !description || !jobId) {
    return null
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    publicExperienceChecked: true,
    requisitionId: jobId,
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createSenecaGlobalITServicesScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Seneca Global IT Services careers page no longer matches the trusted first-party surface')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('The verified Seneca Global IT Services careers page no longer exposes same-domain detail links')
    }

    const scrapedAt = now()
    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`The verified Seneca Global IT Services detail page no longer matches the trusted first-party surface: ${card.detailUrl}`)
      }

      const job = extractJobFromDetailHtml(detailHtml, card, { scrapedAt })
      if (!job) {
        throw new Error(`The verified Seneca Global IT Services detail page no longer returns a normalized job: ${card.detailUrl}`)
      }

      jobs.push({
        ...job,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'senecaglobal.com',
        atsPlatform: 'official-company-careers',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSenecaGlobalITServicesScraper(options).run(options)

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
