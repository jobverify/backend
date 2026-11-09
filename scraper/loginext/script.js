import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { LOGINEXT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LOGINEXT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const JOBS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const TRAKSTAR_ROOT_URL = 'https://loginext.hire.trakstar.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERNS = [
  /\bindia\b/i,
  /\bmumbai\b/i,
  /\bbengaluru\b|\bbangalore\b/i,
  /\bhyderabad\b/i,
  /\bpune\b/i,
  /\bgurugram\b|\bgurgaon\b/i,
  /\bnoida\b/i,
  /\bnew delhi\b|\bdelhi\b/i,
  /\bchennai\b/i,
  /\bkolkata\b/i,
  /\bahmedabad\b/i,
  /\bcoimbatore\b/i,
  /\bjaipur\b/i,
  /\bindore\b/i,
  /\bkochi\b|\bernakulam\b/i,
]

const NON_INDIA_LOCATION_PATTERNS = [
  /\bchicago\b/i,
  /\bunited states\b|\busa\b|\bu\.s\.\b/i,
  /\bsingapore\b/i,
  /\blondon\b|\buk\b|\bunited kingdom\b/i,
  /\bdubai\b|\buae\b|\bunited arab emirates\b/i,
  /\bindonesia\b/i,
  /\bczech\b|\bczechia\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeField = (value) => normalizeWhitespace(value) || null

const decodeJsonString = (value) => {
  try {
    return JSON.parse(`"${String(value ?? '')}"`)
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const nextFlightStringPattern = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g
const roleGroupPattern = /"department":"([^"]+)","noOfPositions":\d+,"roles":(\[[\s\S]*?\])\s*\}/g

const extractFlightPayloads = (html = '') => {
  const payloads = []

  for (const match of String(html ?? '').matchAll(nextFlightStringPattern)) {
    const decoded = decodeJsonString(match[1])
    if (decoded) payloads.push(decoded)
  }

  return payloads
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*LogiNext\s*\|\s*Join Our Team\s*\|\s*Job Opportunities\s*<\/title>/i.test(page)
    && /build something you love/i.test(text)
    && /find jobs/i.test(text)
    && /https:\/\/loginext\.hire\.trakstar\.com/i.test(page)
    && /https:\/\/loginext\.recruiterbox\.com\/jobs\//i.test(page)
  }

export const isIndiaLocation = (location) => {
  const normalized = normalizeField(location)
  if (!normalized) return false
  if (NON_INDIA_LOCATION_PATTERNS.some((pattern) => pattern.test(normalized))) return false
  return INDIA_LOCATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const extractEmbeddedRoleRecords = (html = '') => {
  const page = String(html ?? '')
  const payloads = extractFlightPayloads(page)
  const roleRecords = []

  for (const payload of payloads) {
    if (!/department":"[^"]+"/.test(payload) || !/recruiterbox\.com\/jobs\//i.test(payload)) {
      continue
    }

    for (const match of payload.matchAll(roleGroupPattern)) {
      const department = normalizeField(match[1])
      if (!department) continue

      let roles = []

      try {
        roles = JSON.parse(match[2])
      } catch {
        continue
      }

      for (const role of roles) {
        const id = normalizeField(role?.id)
        const title = normalizeField(role?.title)
        const description = normalizeField(role?.description)
        const location = normalizeField(role?.location)
        const link = normalizeField(role?.link)

        if (!id || !title || !description || !location || !link) continue
        if (!/^https:\/\/loginext\.recruiterbox\.com\/jobs\/[^/\s]+\/?$/i.test(link)) continue

        roleRecords.push({
          department,
          id,
          title,
          description,
          location,
          link,
        })
      }
    }
  }

  return roleRecords
}

const extractCity = (location) => {
  const normalized = normalizeField(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || normalized
}

const extractExperienceRequired = (jobDescription) => {
  const { experienceProfile } = extractJobFilterSignals({
    description: jobDescription,
  })

  return experienceProfile?.confidence === 'high'
    ? experienceProfile.evidence || null
    : null
}

export const mapRoleRecordToJob = (role, { scrapedAt = new Date().toISOString() } = {}) => {
  const title = normalizeField(role?.title)
  const department = normalizeField(role?.department)
  const roleId = normalizeField(role?.id)
  const location = normalizeField(role?.location)
  const sourceUrl = normalizeField(role?.link)
  const description = normalizeField(role?.description)
  const jobDescription = [
    `Team: ${department}`,
    `Location: ${location}`,
    '',
    description,
  ].join('\n')
  const experienceRequired = extractExperienceRequired(jobDescription)
  const hasPublicDetailEvidence = Boolean(description && description.length >= 80)

  if (!title || !department || !roleId || !location || !sourceUrl || !description) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department,
    location: `${location}, India`,
    city: extractCity(location),
    country: 'India',
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: `${SOURCE}-${roleId}`,
    requisitionId: roleId,
    employmentType: null,
    workplaceType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription,
    publicExperienceChecked: hasPublicDetailEvidence && !experienceRequired,
    source: SOURCE,
    companyCareerPage: JOBS_PAGE_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: sourceUrl,
    scrapedAt,
  }
}

const dedupeJobs = (jobs) => {
  const seen = new Set()
  const uniqueJobs = []

  for (const job of jobs) {
    const key = `${job.jobId}|${job.link}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueJobs.push(job)
  }

  return uniqueJobs
}

export const createLogiNextScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(JOBS_PAGE_URL)

    if (page.status !== 200 || page.url !== JOBS_PAGE_URL || !hasOfficialJobsPageSignal(page.html)) {
      throw new Error('LogiNext verified jobs page no longer matches the known first-party surface')
    }

    const roleRecords = extractEmbeddedRoleRecords(page.html)

    if (roleRecords.length === 0) {
      throw new Error('LogiNext verified jobs page no longer matches the known embedded role data contract')
    }

    const scrapedAt = now()

    return dedupeJobs(
      roleRecords
        .filter((role) => isIndiaLocation(role.location))
        .map((role) => mapRoleRecordToJob(role, { scrapedAt }))
        .filter(Boolean),
    )
  },
})

export const run = async (options = {}) => (await import('./currentNative.js')).runCurrentLogiNext(options)

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
