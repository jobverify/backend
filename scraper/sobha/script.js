import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { projectPeopleStrongHTML } from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import { sourcePublicationDateFields } from '../../src/utils/jobPublicationDate.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sobha'
export const COMPANY = 'Sobha Limited'
export const CAREERS_URL = 'https://www.sobha.com/careers/'
export const PEOPLESTRONG_PORTAL_URL = 'https://sobhalimited-careers.peoplestrong.com/'
export const PEOPLESTRONG_URLINFO_API_URL = 'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/urlinfo'

const PEOPLESTRONG_JOBS_API_BASE = 'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1'
const API_BASE = 'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/'
const DETAIL_PARTS = 'basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

const unique = (values) => [...new Set(values.map(normalizeWhitespace).filter(Boolean))]

const deriveCity = (location) => {
  const parts = String(location ?? '').split('>').map(normalizeWhitespace).filter(Boolean)
  if (parts.length >= 3 && /^India$/i.test(parts[0])) return parts[2]
  return null
}

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parts = normalized.split('>').map(normalizeWhitespace).filter(Boolean)
  if (parts.length >= 3 && /^India$/i.test(parts[0])) {
    return [parts[2], parts[1], 'India'].filter(Boolean).join(', ')
  }

  return normalized
}

const buildJobDetailUrl = (job = {}) => {
  const explicit = normalizeWhitespace(job?.jobDetailUrl)
  if (explicit) return explicit

  const jobCode = normalizeWhitespace(job?.jobCode)
  return jobCode
    ? `${PEOPLESTRONG_PORTAL_URL}job/detail/${encodeURIComponent(jobCode)}`
    : null
}

export const buildPeopleStrongJobsApiUrl = ({ offset = 0, limit = 100 } = {}) =>
  `${PEOPLESTRONG_JOBS_API_BASE}?offset=${Number(offset)}&limit=${Number(limit)}`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /Recruitment Fraud Alert/i.test(page)
    && /SOBHA Limited follows a transparent and merit-based recruitment process\./i.test(page)
    && /current openings/i.test(normalized)
}

export const hasPeopleStrongPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(page)
    && (/<app-root>\s*<\/app-root>/i.test(page) || /assets\/css\/styles_v2\.css/i.test(page))
}

export const hasVerifiedPeopleStrongUrlInfo = (payload = {}) => {
  const response = payload?.response ?? {}

  return response?.url === 'sobhalimited-careers.peoplestrong.com'
    && Number(response?.realm) === 1368
    && /sobha/i.test(String(response?.leftLogo ?? ''))
}

export const extractIndiaJobsFromPeopleStrongPayload = (
  payload = {},
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.response) ? payload.response : null
  if (!jobs) {
    throw new Error('Sobha PeopleStrong jobs API response no longer matches the expected jobs array')
  }

  return jobs
    .filter((job) => /India/i.test([
      job?.locationHierarchy,
      job?.locationHierarchyComplete,
    ].filter(Boolean).join(' ')))
    .map((job) => {
      const title = normalizeWhitespace(job?.jobTitle || job?.designation)
      const jobId = normalizeWhitespace(job?.jobCode || job?.requisitionId)
      const requisitionId = normalizeWhitespace(job?.requisitionId)
      const rawLocation = normalizeWhitespace(job?.locationHierarchyComplete || job?.locationHierarchy)
      const location = formatLocation(rawLocation)
      const sourceUrl = buildJobDetailUrl(job)

      if (!title || !jobId || !location || !sourceUrl) return null

      const skills = unique([
        ...toArray(job?.skills?.mustTohave),
        ...toArray(job?.skills?.goodtohave),
      ])

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(rawLocation),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId,
        requisitionId,
        department: normalizeWhitespace(job?.organizationUnit || job?.organizationUnitComplete),
        employmentType: normalizeWhitespace(job?.jobType || job?.employmentType),
        experienceRequired: normalizeWhitespace(job?.expRange),
        jobDescription: normalizeWhitespace(job?.jobDescription || job?.description),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: skills,
        postingDate: normalizeWhitespace(job?.jobPostedDate),
        validThrough: normalizeWhitespace(job?.jobClosureDate),
        remoteStatus: /\bremote\b/i.test(location) ? 'Remote' : 'On-site',
        scrapedAt,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  signal: options.signal,
  method: options.method || 'GET',
  body: options.body ? JSON.stringify(options.body) : undefined,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    Referer: PEOPLESTRONG_PORTAL_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const publicRoleCode = job => {
  try {
    const url = new URL(job.sourceUrl)
    const advertised = encodeURIComponent(String(job.jobId).replaceAll('/', '_'))
    return url.origin === new URL(PEOPLESTRONG_PORTAL_URL).origin
      && url.pathname === `/job/detail/${advertised}` && !url.search && !url.hash && !url.username && !url.password
      ? advertised : null
  } catch { return null }
}

export const buildSobhaDetailUrls = job => {
  const code = publicRoleCode(job)
  return code ? {
    detail: `${API_BASE}job/${code}/v2?part=${DETAIL_PARTS}&isReqId=false`,
    organization: `${API_BASE}job/organizationDetails?jobCode=${encodeURIComponent(job.jobId)}`,
  } : null
}

// The anonymous endpoints and parts string are established by the current
// JobModule, its imported CommonService and captured public network responses.
export const fetchSobhaJobDetail = async (job, { signal, fetchImpl = fetch, timeoutMs = 15000 } = {}) => {
  const urls = buildSobhaDetailUrls(job)
  if (!urls) return null
  const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
  const read = url => fetchJsonWithRetry(url, { method: 'GET', signal: boundedSignal, fetchImpl,
    attempts: 1, timeoutMs, includeResponseMetadata: true, label: SOURCE,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', Referer: job.sourceUrl } })
  const detail = await read(urls.detail)
  boundedSignal.throwIfAborted()
  const organization = await read(urls.organization)
  boundedSignal.throwIfAborted()
  return { detail, organization }
}

const boundPayload = (response, url) => response?.status === 200 && response.url === url
  && response.payload?.messageCode?.code === 200 ? response.payload.response : null
const nativeDate = value => {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})(?: 00:00:00\.0)?$/)
  if (!match) return null
  const date = new Date(`${match[1]}T00:00:00Z`)
  return Number.isFinite(+date) && date.toISOString().startsWith(match[1]) ? match[1] : null
}
const typedValue = (rows, type) => {
  const selected = Array.isArray(rows) ? rows.filter(row => row.orgUnitType === type) : []
  return selected.length === 1 ? normalizeWhitespace(selected[0].orgUnitName) : null
}
const positiveId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0

export const recoverSobhaDescription = (job, listing, response, urlInfo) => {
  const urls = buildSobhaDetailUrls(job)
  if (!urls || !hasVerifiedPeopleStrongUrlInfo(urlInfo)) return null
  const detail = boundPayload(response?.detail, urls.detail)
  const organization = boundPayload(response?.organization, urls.organization)
  if (!detail || !organization || detail.requisitionCode !== listing.jobCode || job.jobId !== listing.jobCode
    || detail.jobTitle !== listing.jobTitle || detail.jobTitle !== job.title || detail.confidential !== false
    || !positiveId(detail.requisitionId) || !positiveId(detail.entityID)
    || !positiveId(detail.hrOrgUnitID) || !positiveId(detail.worksiteID)
    || (listing.requisitionId != null && String(listing.requisitionId) !== String(detail.requisitionId))) return null
  for (const field of ['entityID', 'hrOrgUnitID', 'worksiteID']) {
    if (listing[field] != null && String(listing[field]) !== String(detail[field])) return null
  }
  const company = typedValue(organization.orgUnitHierarchy, 'Company')
  const country = typedValue(organization.workSiteHierarchy, 'Country')
  const state = typedValue(organization.workSiteHierarchy, 'State')
  const city = typedValue(organization.workSiteHierarchy, 'City')
  if (company !== 'Sobha ltd' || normalizeWhitespace(listing.organizationUnit) !== company
    || !String(listing.organizationUnitComplete).startsWith(`${company}>`)
    || listing.organizationUnitComplete !== detail.organizationUnitComplete
    || country !== 'India' || !state || !city
    || listing.locationHierarchyComplete !== detail.locationHierarchyComplete
    || !String(detail.locationHierarchyComplete).startsWith(`${country}>${state}>${city}>`)
    || (detail.joiningLocation != null && detail.joiningLocation !== country)
    || [listing, detail].some(row => ['country', 'countryName', 'countryCode'].some(field =>
      row[field] != null && !['India', 'IN', 'IND'].includes(String(row[field]))))) return null
  const postingDate = nativeDate(detail.CandidatePortalStartDate)
  const closingDate = nativeDate(detail.CandidatePortalEndDate)
  if (!postingDate || !closingDate || closingDate < postingDate
    || postingDate !== listing.jobPostedDate || closingDate !== listing.jobClosureDate) return null
  if (typeof detail.jobDescription !== 'string') return null
  // Preserve the exact HTML separately; project only active public content.
  // Decode source entities absent from the shared small entity table first.
  const html = detail.jobDescription.replace(/&ccedil;/g, '\u00e7').replace(/&Ccedil;/g, '\u00c7')
    .replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014')
  const projected = projectPeopleStrongHTML(html)
  if (!projected.text || projected.text.length < 80) return null
  const strings = values => Array.isArray(values) && values.every(value => typeof value === 'string')
    ? values.map(normalizeWhitespace).filter(Boolean) : []
  const qualifications = strings(detail.qualifications)
  const skills = Array.isArray(detail.skills) ? detail.skills.map(skill => normalizeWhitespace(skill?.text)).filter(Boolean) : []
  const certifications = strings(detail.certifications), languages = strings(detail.languages)
  const sourceDescription = [projected.text,
    qualifications.length ? `Minimum Qualification: ${qualifications.join('; ')}` : null,
    skills.length ? `Skills: ${skills.join('; ')}` : null,
    certifications.length ? `Certifications: ${certifications.join('; ')}` : null,
    languages.length ? `Working Language: ${languages.join('; ')}` : null,
  ].filter(Boolean).join('\n\n')
  return { sourceDescription, jobDescriptionHtml: detail.jobDescription,
    requisitionId: String(detail.requisitionId), sourceNativeRealm: 1368,
    ...sourcePublicationDateFields(postingDate), closingDate, validThrough: closingDate,
    sourceDateEvidence: 'sobha-peoplestrong-native-detail-listing-v1', sourceDatePrecision: 'day',
    sourceClosingDateIsExact: false, nativeRequisitionStatus: detail.requisitionStatus,
    sourceCountryEvidence: { method: 'native-role-requested-typed-country', country,
      worksiteID: String(detail.worksiteID), requisitionCode: detail.requisitionCode },
    sourceDetailComplete: projected.complete, minimumQualification: qualifications.join('; ') || null,
    employmentType: normalizeWhitespace(detail.employmentType),
  }
}

export const createSobhaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchJobDetail,
    signal,
    detailEnrichmentBudgetMs,
    now = () => new Date().toISOString(),
  } = {}) {
    signal?.throwIfAborted()
    const requestOptions = signal ? { signal } : {}
    const careersHtml = await fetchText(CAREERS_URL, requestOptions)
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Sobha careers page no longer matches the verified official careers surface')
    }

    const portalHtml = await fetchText(PEOPLESTRONG_PORTAL_URL, requestOptions)
    signal?.throwIfAborted()
    if (!hasPeopleStrongPortalSignal(portalHtml)) {
      throw new Error('Sobha PeopleStrong Candidate Portal no longer matches the verified handoff')
    }

    const urlInfo = await fetchJson(PEOPLESTRONG_URLINFO_API_URL, { method: 'GET', ...requestOptions })
    signal?.throwIfAborted()
    if (!hasVerifiedPeopleStrongUrlInfo(urlInfo)) {
      throw new Error('Sobha PeopleStrong company identity no longer matches the verified portal')
    }

    const payload = await fetchJson(buildPeopleStrongJobsApiUrl({ offset: 0, limit: 100 }), {
        method: 'POST',
        body: {},
        ...requestOptions,
      })
    signal?.throwIfAborted()
    const jobs = extractIndiaJobsFromPeopleStrongPayload(payload,
      { scrapedAt: now() },
    )
    // Listing-only injected transports do not trigger unrelated live reads.
    const detailReader = fetchJobDetail || (fetchText === defaultFetchText && fetchJson === defaultFetchJson ? fetchSobhaJobDetail : null)
    if (!detailReader) return jobs
    const details = new Map()
    const hydrated = await hydrateSourceDescriptions(jobs, { signal, detailEnrichmentBudgetMs,
      fetchDetail: async (job, options) => {
        const listing = payload.response.find(row => row.jobCode === job.jobId)
        const detail = recoverSobhaDescription(job, listing, await detailReader(job, options), urlInfo)
        if (detail) details.set(job.jobId, detail)
        return detail
      },
    })
    return hydrated.map(job => job.sourceDescription && details.has(job.jobId) ? {
      ...job, ...details.get(job.jobId),
      ...(!details.get(job.jobId).sourceDetailComplete ? { sourceDetailFailureKind: 'public-html-projection-incomplete' } : {}),
    } : job)
  },
})

export const run = async (options = {}) => createSobhaScraper().run(options)

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
