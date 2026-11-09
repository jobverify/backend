import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import KIRAN_FOREIGN_TRADE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KIRAN_FOREIGN_TRADE_CATALOG
export const SOURCE = KIRAN_FOREIGN_TRADE_CATALOG.source
export const COMPANY = KIRAN_FOREIGN_TRADE_CATALOG.companyName
export const CAREERS_URL = KIRAN_FOREIGN_TRADE_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LOCATION = 'Mohali, Punjab, India'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|option|select|label)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const inferDepartment = (title) => {
  const normalized = normalizeWhitespace(title)

  if (/designer/i.test(normalized)) return 'Design'
  if (/seo/i.test(normalized)) return 'Marketing'
  if (/developer|tester/i.test(normalized)) return 'Engineering'

  return null
}

export const hasOfficialCareerPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Welcome To Kft Software We Design your future')
    && normalized.includes('Apply For Jobs')
    && normalized.includes('Taking your career to the next level')
    && normalized.includes('Job applying for?')
}

export const extractPositionTitles = (html = '') => {
  const block = String(html ?? '').includes('Job applying for?')
    ? String(html ?? '').split('Job applying for?')[1].split('Total work experience')[0]
    : String(html ?? '')

  const titles = [...block.matchAll(/<option[^>]*>([^<]+)<\/option>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((title) => title !== 'Select Position')

  if (titles.length > 0) {
    return titles
  }

  const fallback = normalizeWhitespace(block).match(/Select Position\s+(.+)$/i)?.[1] || ''
  return fallback
    .split(/\s{2,}/)
    .map((title) => normalizeWhitespace(title))
    .filter(Boolean)
}

const buildJob = (title) => ({
  title,
  company: COMPANY,
  department: inferDepartment(title),
  location: LOCATION,
  city: 'Mohali',
  country: 'India',
  jobId: slugify(title),
  requisitionId: slugify(title),
  sourceUrl: `${CAREERS_URL}#${slugify(title)}`,
  applyUrl: CAREERS_URL,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: 'Taking your career to the next level at KFT, I-60, Alpha IT City, Sector 83, Mohali (160055).',
})

export const createKiranForeignTradeScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareerPageSignal(careersHtml)) {
      throw new Error('The verified Kiran Foreign Trade careers surface no longer matches the trusted first-party application-form page')
    }

    const titles = extractPositionTitles(careersHtml)
    if (titles.length === 0) {
      throw new Error('The verified Kiran Foreign Trade position dropdown no longer exposes the trusted first-party roles')
    }

    return titles.map((title) => ({
      ...buildJob(title),
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createKiranForeignTradeScraper(options).run(options)

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
