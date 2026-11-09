import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachGreenhouseSourceEvidence } from '../../scraper-support/utils/greenhouseSourceEvidence.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { validatePublicPostingScope } from '../../scraper-support/utils/publishingGapAts.js'

import { GLANCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GLANCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const VERIFIED_SAMPLE_JOB_ID = '7528886'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const hasIndiaMarker = (value) => /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(String(value ?? ''))

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const isIndiaJob = (job = {}) => {
  const baseCountry = extractMetadataValue(job, 'Base Country')
  if (baseCountry?.toLowerCase().includes('india')) return true

  const primaryLocation = normalizeWhitespace(job?.location?.name)
  if (hasIndiaMarker(primaryLocation)) return true
  if (/(bangalore|bengaluru)/i.test(primaryLocation || '')) return true

  return extractOfficeLocations(job).some((location) => hasIndiaMarker(location) || /(bangalore|bengaluru)/i.test(location))
}

const chooseIndiaLocation = (job = {}) => {
  const officeLocation = extractOfficeLocations(job).find(
    (location) => hasIndiaMarker(location) || /(bangalore|bengaluru)/i.test(location),
  )
  if (officeLocation) return officeLocation

  const primaryLocation = normalizeWhitespace(job?.location?.name)
  if (!primaryLocation) return null
  if (hasIndiaMarker(primaryLocation)) return primaryLocation
  if (/(bangalore|bengaluru)/i.test(primaryLocation)) return `${primaryLocation}, India`

  return null
}

const deriveCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizeGreenhouseApplyUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')

    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== `/glance/jobs/${canonicalJobId}`) return null

    return `https://job-boards.greenhouse.io/glance/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const normalizeFirstPartyJobUrl = (jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null
  return `https://glance.com/careers/${canonicalJobId}`
}

export const extractNextDataPayload = (html = '') => {
  const carriers = readNativeDocument(String(html ?? '')).nodes(node => node.tag === 'script'
    && node.attrs.id === '__NEXT_DATA__' && !node.attrs.src)
  if (carriers.length !== 1) return null
  try {
    return JSON.parse(carriers[0].raw)
  } catch {
    return null
  }
}

const flattenEmbeddedJobs = (jobsDepartmentWise) => {
  if (!jobsDepartmentWise || typeof jobsDepartmentWise !== 'object' || Array.isArray(jobsDepartmentWise)
    || Object.getPrototypeOf(jobsDepartmentWise) !== Object.prototype) {
    throw new Error('Glance embedded inventory requires a department object of job arrays')
  }
  const departments = Object.values(jobsDepartmentWise)
  if (departments.some(entries => !Array.isArray(entries)
    || entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.getPrototypeOf(entry) !== Object.prototype))) {
    throw new Error('Glance embedded inventory requires every department array and job row to be valid')
  }
  return departments.flat()
}

const readEmbeddedJobs = payload => {
  const pageProps = payload?.props?.pageProps
  if (!pageProps || typeof pageProps !== 'object' || Array.isArray(pageProps)
    || !Object.hasOwn(pageProps, 'jobsDepartmentWise')) {
    throw new Error('Glance embedded inventory requires its own jobsDepartmentWise map')
  }
  return flattenEmbeddedJobs(pageProps.jobsDepartmentWise)
}

export const extractEmbeddedFirstPartyJobs = (html = '') => readEmbeddedJobs(extractNextDataPayload(html))

// Glance explicitly publishes this source-owned multi-select country field.
// Recognize it only in this validation view; retain the original feed and literal
// field provenance, and leave the shared Greenhouse vocabulary unchanged.
const glanceCountryValidationView = payload => {
  if (!Array.isArray(payload?.jobs)) throw new Error('Glance expected native jobs inventory')
  return { ...payload, jobs: payload.jobs.map(record => {
    if (record.isListed === false) throw new Error('Glance explicitly unlisted native role')
    const employer = normalizeWhitespace(record.company_name)
    if (employer && employer.toLowerCase() !== COMPANY.toLowerCase()) throw new Error('Glance native payload no longer maps to the verified company identity: foreign employer declaration')
    const fields = Array.isArray(record?.metadata) ? record.metadata : []
    const countryFields = fields.filter(field => /countr(?:y|ies)/i.test(field?.name || ''))
    const base = countryFields[0]
    if (countryFields.length !== 1 || base?.name !== 'Base Country'
      || !Array.isArray(base.value) || base.value.length !== 1
      || typeof base.value[0] !== 'string' || !base.value[0].trim() || base.value[0].length > 160
      || JSON.stringify(base).length > 1024
      || (Object.hasOwn(base, 'value_type') && base.value_type !== 'multi_select')) {
      throw new Error('Glance malformed or ambiguous native Base Country')
    }
    return { ...record, metadata: fields.map(field => field === base ? { ...field, name: 'Country' } : field) }
  }) }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const payload = extractNextDataPayload(page)
  let jobs
  try { jobs = readEmbeddedJobs(payload) } catch { return false }

  return page.includes('__NEXT_DATA__')
    && payload?.page === '/careers'
    && page.includes('Careers at Glance')
    && page.includes('Come build what millions see every day')
    && jobs.length > 0
    && jobs.every((job) => normalizeGreenhouseApplyUrl(job?.absolute_url, job?.id))
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    allowedJobIds = null,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Glance Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => {
      if (!isIndiaJob(job)) return false
      if (!allowedJobIds) return true
      return allowedJobIds.has(String(job?.id))
    })
    .map((job) => {
      const location = chooseIndiaLocation(job)
      const applyUrl = normalizeGreenhouseApplyUrl(job?.absolute_url, job?.id)
      const sourceUrl = normalizeFirstPartyJobUrl(job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)

      if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('Glance Greenhouse payload no longer maps to the verified company identity')
      }

      if (!location || !applyUrl || !sourceUrl || !title) {
        throw new Error('Glance Greenhouse payload no longer exposes the verified first-party detail route and apply handoff')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location),
        country: 'India',
        link: sourceUrl,
        applyUrl,
        sourceUrl,
        source: SOURCE,
        jobId: String(job?.id),
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: extractMetadataValue(job, 'Department Name (Career Site)'),
        employmentType: extractMetadataValue(job, 'Employment Type'),
        experienceRequired: null,
        jobDescription: decodeRepeatedHtmlEntities(job?.content) || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus: 'On-site',
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGlanceScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Glance verified first-party careers page no longer matches the trusted public surface')
    }

    const embeddedJobs = extractEmbeddedFirstPartyJobs(careersHtml)
    const allowedJobIds = new Set(
      embeddedJobs
        .filter((job) => isIndiaJob(job))
        .map((job) => String(job.id)),
    )

    const greenhousePayload = await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' })
    const greenhouseJobs = greenhousePayload?.jobs
    const greenhouseIds = new Set(Array.isArray(greenhouseJobs) ? greenhouseJobs.map((job) => String(job?.id)) : [])
    const embeddedIds = new Set(embeddedJobs.map((job) => String(job?.id)))
    if (!Array.isArray(greenhouseJobs)
      || embeddedIds.size !== embeddedJobs.length
      || greenhouseIds.size !== greenhouseJobs.length
      || embeddedIds.size !== greenhouseIds.size
      || [...embeddedIds].some((id) => !greenhouseIds.has(id))) {
      throw new Error('Glance first-party and Greenhouse job inventories disagree')
    }

    const validationPayload = glanceCountryValidationView(greenhousePayload)
    const officialValidation = glanceCountryValidationView({ jobs: embeddedJobs })
    const officialRecords = new Map(embeddedJobs.map(record => [String(record.id), record]))
    const officialCountries = new Map(officialValidation.jobs.map(record => [String(record.id),
      record.metadata.find(field => field.name === 'Country').value[0]]))
    for (const record of validationPayload.jobs) {
      const country = record.metadata.find(field => field.name === 'Country').value[0]
      if (country.trim().toLowerCase() !== officialCountries.get(String(record.id))?.trim().toLowerCase()) {
        throw new Error('Glance first-party and native Base Country disagree')
      }
    }
    const scopeReasons = validatePublicPostingScope(officialValidation.jobs, 'greenhouse', {
      source: SOURCE, boardToken: 'glance', companyCareerPage: CAREERS_URL,
    })
    const jobs = extractIndiaJobsFromGreenhousePayload(
      greenhousePayload,
      {
        allowedJobIds,
        scrapedAt: now(),
      },
    )

    const selected = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const evidenced = await attachGreenhouseSourceEvidence(selected, {
      source: SOURCE, companyName: COMPANY, companyCareerPage: CAREERS_URL,
      boardToken: 'glance', payload: validationPayload, officialHtml: careersHtml,
    })
    const reasons = [...scopeReasons]
    if (!Number.isSafeInteger(greenhousePayload.meta?.total)
      || greenhousePayload.meta.total !== greenhouseJobs.length) reasons.push('native-total-unverified')
    for (const job of evidenced) {
      const native = greenhouseJobs.find(record => String(record.id) === job.jobId)
      const nativeMetadata = native.metadata.find(field => field.name === 'Base Country')
      const officialMetadata = officialRecords.get(job.jobId).metadata.find(field => field.name === 'Base Country')
      job.sourceNativeCountryEvidence = { field: 'metadata.Base Country', interpretation: 'country',
        validationViewField: 'Country', value: nativeMetadata.value[0],
        officialValue: officialCountries.get(job.jobId),
        nativeMetadata: structuredClone(nativeMetadata), officialMetadata: structuredClone(officialMetadata) }
      const content = extractActiveDescription(job.jobDescription)
      job.sourceDetailComplete = Boolean(content && content.length >= 200 && content.split(/\s+/).length >= 30)
      if (!job.sourceDetailComplete) {
        job.sourceDetailFailureKind = 'missing-content'
        reasons.push('selected-role-description-not-substantive')
      }
    }
    const evidence = readInventoryEvidence(evidenced)
    if (reasons.length) for (const job of evidenced) job.sourceListingComplete = false
    return attachInventoryEvidence(evidenced, { ...evidence,
      ...(reasons.length ? { status: 'discovery-only', listingComplete: false } : {}),
      reason: evidence.reason + ':glance-native-Base-Country-validated'
        + (reasons.length ? ':' + [...new Set(reasons)].join(';') : ''),
    })
  },
})

export const run = async (options = {}) => createGlanceScraper(options).run(options)

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
