import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { REAL_TIME_DATA_SERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_FORM_URL = PROVIDER_METADATA.applyFormUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return `${normalized} years`
  if (/^\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?$/i.test(normalized)) {
    return `${normalized} years`
  }
  return normalized
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseHtmlAttributeJson = (value) => JSON.parse(
  decodeHtmlEntities(value)
    .replace(/&quot;/g, '"'),
)

export const hasOfficialCareersSignal = (html = '') => {
  const text = stripTags(html)
  return text.includes('Career at RTDS')
    && text.includes('Apply Now')
    && text.includes('Software Development')
}

export const extractOpportunityPayloads = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /<div class="col opportunities" data-positions="([^"]*)">[\s\S]*?<a href="([^"]+)"[^>]*aria-label="([^"]+)"/gi,
  )

  return [...matches]
    .map((match) => ({
      positions: parseHtmlAttributeJson(match[1]),
      departmentUrl: match[2],
      department: stripTags(match[3]),
    }))
    .filter((entry) => Array.isArray(entry.positions) && entry.positions.length > 0)
}

const buildLocation = (value) => {
  const location = normalizeWhitespace(value)
  return location ? `${location}, India` : 'India'
}

export const createRealTimeDataServicesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified RTDS careers page no longer matches the trusted first-party surface')
    }

    const payloads = extractOpportunityPayloads(html)
    if (payloads.length === 0) {
      throw new Error('The verified RTDS careers page no longer exposes the trusted inline position payloads')
    }

    return payloads.flatMap((entry) => entry.positions
      .filter((position) => position?.status === 'active')
      .map((position) => {
        const location = normalizeWhitespace(position.location)
        const jobId = `${slugify(position.name)}-${slugify(location)}`

        return {
          title: normalizeWhitespace(position.name),
          company: COMPANY,
          department: entry.department,
          location: buildLocation(location),
          city: location ? location.split(',')[0]?.trim() ?? null : null,
          country: 'India',
          sourceUrl: CAREERS_URL,
          applyUrl: APPLY_FORM_URL,
          jobId,
          requisitionId: jobId,
          employmentType: normalizeWhitespace(position.mode),
          experienceRequired: normalizeExperienceRequired(position.experience),
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: normalizeWhitespace(position.posted_date),
          closingDate: null,
          jobDescription: normalizeWhitespace(position.description) || entry.department,
          publicExperienceChecked: true,
          remoteStatus: /remote/i.test(position.mode) ? 'Remote' : 'On-site',
          source: SOURCE,
          link: entry.departmentUrl,
          scrapedAt: now(),
          companyCareerPage: CAREERS_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
        }
      }))
  },
})

export const run = async (options = {}) => createRealTimeDataServicesScraper(options).run(options)

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
