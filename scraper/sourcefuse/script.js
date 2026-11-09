import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SOURCEFUSE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SOURCEFUSE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_LANDING_URL = PROVIDER_METADATA.officialCareersPageUrl
export const INDIA_OPENINGS_URL = PROVIDER_METADATA.indiaOpeningsUrl
export const APPLICATION_FORM_ACTION = PROVIDER_METADATA.verifiedApplicationFormAction
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toJobId = (title) => `sourcefuse-${slugify(title)}`

const extractMetaTexts = (segment) =>
  [...String(segment ?? '').matchAll(/sf-jobs__meta-text">([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractLabelValue = (segment, label) => {
  const pattern = new RegExp(`${label}\\s*([^<]+)`, 'i')
  const match = String(segment ?? '').match(pattern)
  return match?.[1] ? normalizeWhitespace(match[1]) : null
}

const extractRoleOverview = (segment) => {
  const match = String(segment ?? '').match(
    /Role Overview:\s*<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
  )

  return match?.[1] ? stripTags(match[1]) : null
}

const extractCityFromLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null

  return location.replace(/,\s*India$/i, '').trim() || null
}

const normalizeExperienceValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.replace(/years experience$/i, 'Years').trim()
}

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const withoutTrailingNotes = normalized.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  if (/\bindia\b/i.test(withoutTrailingNotes)) {
    return withoutTrailingNotes
  }

  return `${withoutTrailingNotes}, India`
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialIndiaOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers\s*-\s*SourceFuse\s*<\/title>/i.test(page)
    && (
      normalized.includes('India Openings with SourceFuse.')
      || /sf-jobs__title-text/i.test(page)
    )
    && /sf-jobs__list-section/i.test(page)
  }

export const hasApplicationFormSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes(`action="${APPLICATION_FORM_ACTION}"`)
    && /name=["']your-job-name["']/i.test(page)
    && /data-name=["']your-cv["']/i.test(page)
    && /accept=["'][^"']*\.pdf(?:\s*,|\s*["'])/i.test(page)
  }

export const extractJobCards = (html = '') =>
  String(html ?? '')
    .split(/<div class="sf-jobs__item\b[^>]*>/i)
    .slice(1)
    .map((segment) => {
      const title = stripTags(segment.match(/sf-jobs__title-text">([\s\S]*?)<\/span>/i)?.[1])
      const [metaLocation, experienceFromMeta, positions] = extractMetaTexts(segment)
      const location = normalizeIndiaLocation(
        extractLabelValue(segment, 'Location:') || metaLocation,
      )
      const experienceRequired = normalizeExperienceValue(
        extractLabelValue(segment, 'Work Experience:') || experienceFromMeta,
      )
      const employmentType = extractLabelValue(segment, 'Job Type:')
      const jobDescription = extractRoleOverview(segment)
      const city = extractCityFromLocation(location)
      const remoteStatus = /\bremote\b/i.test(location ?? '') ? 'Remote' : 'On-site'

      return {
        title,
        location,
        city,
        experienceRequired,
        employmentType,
        positions: normalizeWhitespace(positions),
        jobDescription,
        jobId: title ? toJobId(title) : null,
        remoteStatus,
      }
    })
    .filter((job) => (
      job.title
      && job.location
      && job.experienceRequired
      && job.employmentType
      && job.jobDescription
      && job.jobId
    ))

export const createSourceFuseScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(INDIA_OPENINGS_URL)

    if (!hasOfficialIndiaOpeningsSignal(html)) {
      throw new Error('SourceFuse verified India openings page no longer matches the trusted first-party surface')
    }

    if (!hasApplicationFormSignal(html)) {
      throw new Error('SourceFuse inline application form no longer matches the verified first-party surface')
    }

    const jobCards = extractJobCards(html)
    if (jobCards.length === 0) {
      throw new Error('SourceFuse official India openings page exposes no public India job panels')
    }

    const jobs = jobCards.map((job) => ({
      title: job.title,
      company: COMPANY_NAME,
      department: null,
      location: job.location,
      city: job.city,
      state: null,
      country: 'India',
      jobId: job.jobId,
      requisitionId: null,
      sourceUrl: INDIA_OPENINGS_URL,
      applyUrl: INDIA_OPENINGS_URL,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      remoteStatus: job.remoteStatus,
      source: SOURCE,
      link: INDIA_OPENINGS_URL,
      scrapedAt: now(),
    }))

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createSourceFuseScraper(options).run(options)

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
