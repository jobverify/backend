import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import AMPLELOGIC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AMPLELOGIC_CATALOG.source
export const COMPANY = AMPLELOGIC_CATALOG.companyName
export const CAREERS_URL = AMPLELOGIC_CATALOG.companyCareerPage
export const VERIFIED_TITLES = [
  'Lead Generation Executive',
  'Sales Manager – B2B SaaS / aPaaS - Domestic',
  'Electronic Lab Notebook (ELN) Domain Expert',
  'Sales Manager – B2B SaaS / aPaaS -Europe region',
  'Join Our 90-Day Internship Program',
]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toLocationLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const buildSourceUrl = (title) => `${CAREERS_URL}#${slugify(title)}`

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers at AmpleLogic/i.test(rawHtml)
    && normalized.includes('Find Your Role')
    && normalized.includes('Apply Now')
    && normalized.includes('View Details')
  }

export const extractJobCards = (html = '') => {
  const rawHtml = String(html ?? '')
  const cards = []

  const articleMatches = [...rawHtml.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)]
  for (const match of articleMatches) {
    const articleText = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    if (!title || !articleText.includes('Apply Now')) continue

    const paragraphValues = [...match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)

    const location = paragraphValues.find((value) => /india|hyderabad|bangalore|bengaluru|pune/i.test(value)) || null
    const employmentType = paragraphValues.find((value) => /full-time|internship/i.test(value)) || null
    const experience = paragraphValues.find((value) => /\d+\s*-\s*\d+\s*years|\d+\+\s*years|\d+\+Years/i.test(value)) || null

    cards.push({
      title,
      location,
      employmentType,
      experience,
    })
  }

  if (cards.length > 0) return cards

  const normalized = normalizeWhitespace(rawHtml)
  return VERIFIED_TITLES.flatMap((title) => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = normalized.match(new RegExp(`${escaped}([\\s\\S]{0,200}?)Apply Now\\s+View Details`, 'i'))
    if (!match) return []

    const block = normalizeWhitespace(match[0])
    return [{
      title,
      location: normalizeWhitespace(block.match(/\b([A-Za-z][A-Za-z\s]+(?:,\s*India)?)\b/i)?.[1] ?? null),
      employmentType: normalizeWhitespace(block.match(/\b(Full-time|Internship)\b/i)?.[1] ?? null),
      experience: normalizeWhitespace(block.match(/\b(\d+\s*-\s*\d+\s*years|\d+\+\s*years|\d+\+Years)\b/i)?.[1] ?? null),
    }]
  })
}

const mapJob = (card) => ({
  title: card.title,
  company: COMPANY,
  department: null,
  location: toLocationLabel(card.location || 'Hyderabad'),
  city: 'Hyderabad',
  country: 'India',
  jobId: slugify(card.title),
  requisitionId: slugify(card.title),
  sourceUrl: buildSourceUrl(card.title),
  applyUrl: buildSourceUrl(card.title),
  employmentType: card.employmentType || null,
  experienceRequired: card.experience || null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: null,
})

export const createAmpleLogicScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('AmpleLogic verified careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobCards(careersHtml).map(mapJob)
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAmpleLogicScraper().run(options)

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
