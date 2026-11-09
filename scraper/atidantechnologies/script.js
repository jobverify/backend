import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ATIDAN_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ATIDAN_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 60000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: FETCH_TIMEOUT_MS,
})

const MONTH_INDEX = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const normalizeDate = (value) => {
  const match = String(value ?? '').trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null

  const month = MONTH_INDEX[match[1].toLowerCase()]
  if (!month) return null

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`
}

const extractMetaValue = (html, label) => normalizeWhitespace(
  String(html ?? '').match(new RegExp(`<strong>\\s*${label}\\s*<\\/strong>\\s*([^<]+)`, 'i'))?.[1],
)

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Careers\s*-\s*Atidan Technologies Pvt\.\s*Ltd\.\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Creating exceptional careers with a strong purpose.')
    && normalized.includes('SCCM L3 Engineer')
}

export const extractRoleSummaries = (html = '') =>
  [...String(html ?? '').matchAll(
    /<article[^>]*>[\s\S]*?(?:<time[^>]*>|<div[^>]+class=["'][^"']*\bdate_label\b[^"']*["'][^>]*>)([^<]+)(?:<\/time>|<\/div>)[\s\S]*?<h4[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>[\s\S]*?<\/article>/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[3]),
      detailUrl: normalizeWhitespace(match[2]),
      postingDate: normalizeDate(match[1]),
    }))
    .filter((item) => item.title && item.detailUrl && item.postingDate)

export const extractRoleDetail = (html = '', summary = {}) => ({
  title: summary.title,
  company: COMPANY,
  department: extractMetaValue(html, 'FUNCTIONAL AREA'),
  location: 'Remote, India',
  city: 'Remote',
  country: 'India',
  jobId: summary.detailUrl.split('/').filter(Boolean).at(-1),
  requisitionId: summary.detailUrl.split('/').filter(Boolean).at(-1),
  sourceUrl: summary.detailUrl,
  applyUrl: summary.detailUrl,
  employmentType: null,
  experienceRequired: extractMetaValue(html, 'EXPERIENCE'),
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean),
  postingDate: summary.postingDate,
  closingDate: null,
  jobDescription: normalizeWhitespace(String(html ?? '').match(/<h2[^>]*>\s*Key Responsibilities\s*<\/h2>([\s\S]*?)<\/main>/i)?.[1]),
  remoteStatus: 'Remote',
})

export const createAtidanTechnologiesScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Atidan Technologies careers archive no longer matches the trusted first-party page')
    }

    const summaries = extractRoleSummaries(careersHtml)
    const selectedSummaries = maxJobs ? summaries.slice(0, maxJobs) : summaries
    const detailHtmlByUrl = Object.fromEntries(
      await Promise.all(selectedSummaries.map(async (summary) => [
        summary.detailUrl,
        await fetchText(summary.detailUrl),
      ])),
    )

    return selectedSummaries.map((summary) => ({
      ...extractRoleDetail(detailHtmlByUrl[summary.detailUrl], summary),
      source: SOURCE,
      link: summary.detailUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAtidanTechnologiesScraper().run(options)

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
