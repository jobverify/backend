import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { LEENA_AI_CATALOG } from './catalog.js'
import { runCurrentOrLegacy } from './nativeCurrentWorkable.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = LEENA_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_ROLES_TAB_URL = PROVIDER_METADATA.openRolesTabUrl
export const OPEN_ROLES_SECTION_ID = 'open-roles-section'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const CAREERS_BUNDLE_SCRIPT_PATTERN =
  /<script[^>]+src=["']([^"']*\/_next\/static\/chunks\/pages\/careers-[^"']+\.js)["'][^>]*>/i
const LEENA_PYJAMAHR_ROLE_OBJECT_PATTERN =
  /\{[^{}]*link:"https:\/\/jobs\.pyjamahr\.com\/leena-ai\/(?:\\.|[^"\\])*"[^{}]*\}/g

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const extractNextData = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const parts = normalizeWhitespace(location)?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) || []
  return parts[0] || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const isIndiaRole = (location) => /\bindia\b/i.test(normalizeWhitespace(location) || '')

const decodeJsString = (value) => {
  const source = String(value ?? '')

  try {
    return JSON.parse(`"${source}"`)
  } catch {
    return source
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

const extractJsStringProperty = (objectSource, key) => {
  const match = String(objectSource ?? '').match(
    new RegExp(`${key}:"((?:\\\\.|[^"\\\\])*)"`),
  )

  return normalizeWhitespace(match ? decodeJsString(match[1]) : null)
}

const normalizePyjamaHrJobUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (hostname !== 'jobs.pyjamahr.com') return null
    if (!pathname.startsWith('/leena-ai/')) return null

    return `https://jobs.pyjamahr.com${pathname}${url.search}`
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  switch (String(value ?? '').trim().toUpperCase()) {
    case 'FULLTIME':
    case 'FULL_TIME':
      return 'Full-time'
    case 'PARTTIME':
    case 'PART_TIME':
      return 'Part-time'
    case 'CONTRACT':
      return 'Contract'
    case 'INTERN':
    case 'INTERNSHIP':
      return 'Internship'
    default:
      return normalizeWhitespace(value)
  }
}

const toFiniteNumber = (value) => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const normalizeExperienceRequired = (detail = {}) => {
  const minExperience = toFiniteNumber(detail?.min_experience)
  const maxExperience = toFiniteNumber(detail?.max_experience)

  if (minExperience != null && maxExperience != null) {
    return `${minExperience} - ${maxExperience} years`
  }

  if (minExperience != null) {
    return `${minExperience}+ years`
  }

  const description = stripHtml(detail?.description) || ''
  const rangeMatch = description.match(/\b(\d+)\s*[-–]\s*(\d+)\s+years?\b/i)
  if (rangeMatch) {
    return `${rangeMatch[1]} - ${rangeMatch[2]} years`
  }

  const plusMatch = description.match(/\b(\d+)\+\s*years?\b/i)
  if (plusMatch) {
    return `${plusMatch[1]}+ years`
  }

  return null
}

const normalizeRemoteStatus = (detail = {}, fallbackLocation = null) => {
  switch (String(detail?.workplace_type ?? '').trim().toUpperCase()) {
    case 'REMOTE':
      return 'Remote'
    case 'HYBRID':
      return 'Hybrid'
    case 'ON_SITE':
    case 'ONSITE':
      return 'On-site'
    default:
      return /remote/i.test(normalizeWhitespace(fallbackLocation) || '') ? 'Remote' : 'On-site'
  }
}

export const extractPyjamaHrRoleDetail = (html = '') => {
  const pageProps = extractNextData(html)?.props?.pageProps ?? null
  const detail = pageProps?.jobDetails ?? pageProps?.job ?? null

  if (!detail || typeof detail !== 'object') return null

  const jobDescription = stripHtml(detail.description)

  return {
    title: normalizeWhitespace(detail.title),
    department: normalizeWhitespace(detail.department_name),
    location: normalizeWhitespace(detail.location),
    country: normalizeWhitespace(detail.country),
    employmentType: normalizeEmploymentType(detail.job_type),
    experienceRequired: normalizeExperienceRequired(detail),
    minimumQualification: Array.isArray(detail.education)
      ? detail.education.map((entry) => normalizeWhitespace(entry)).filter(Boolean).join(', ') || null
      : null,
    requiredSkills: Array.isArray(detail.skill)
      ? detail.skill.map((entry) => normalizeWhitespace(entry)).filter(Boolean)
      : [],
    postingDate: normalizeWhitespace(detail.created_at),
    closingDate: normalizeWhitespace(detail.valid_through),
    jobDescription,
    remoteStatus: normalizeRemoteStatus(detail, detail.location),
    publicExperienceChecked: Boolean(jobDescription),
  }
}

const extractPyjamaHrGenericShellEvidence = (html = '', job = {}) => {
  const nextData = extractNextData(html)
  const pageProps = nextData?.props?.pageProps ?? null
  const companyDetails = pageProps?.companyDetails ?? null
  const queryJobUuid = normalizeWhitespace(nextData?.query?.job_uuid || nextData?.query?.jobUuid)
  const title = extractTitle(html) || ''

  const hasGenericShell = (
    title === 'Leena Ai'
    && companyDetails
    && queryJobUuid
  )

  if (!hasGenericShell) return null

  return {
    publicExperienceChecked: true,
    experienceRequired: null,
    jobDescription: null,
  }
}

const mergeRoleDetail = (job, detail) => {
  if (!detail) return job

  return {
    ...job,
    department: detail.department || job.department,
    employmentType: detail.employmentType || job.employmentType,
    experienceRequired: detail.experienceRequired || job.experienceRequired,
    minimumQualification: detail.minimumQualification || job.minimumQualification,
    requiredSkills: detail.requiredSkills.length > 0 ? detail.requiredSkills : job.requiredSkills,
    postingDate: detail.postingDate || job.postingDate,
    closingDate: detail.closingDate || job.closingDate,
    jobDescription: detail.jobDescription || job.jobDescription,
    remoteStatus: detail.remoteStatus || job.remoteStatus,
    publicExperienceChecked: detail.publicExperienceChecked ?? job.publicExperienceChecked ?? false,
  }
}

export const enrichJobsWithPyjamaHrDetails = async (
  jobs,
  fetchText = defaultFetchText,
  { failOnMissingDetail = true } = {},
) => Promise.all(
  jobs.map(async (job) => {
    const detailUrl = normalizePyjamaHrJobUrl(job?.sourceUrl)
    if (!detailUrl) return job

    const detailHtml = await fetchText(detailUrl)
    const detail = extractPyjamaHrRoleDetail(detailHtml)
    if (!detail) {
      const genericShellEvidence = extractPyjamaHrGenericShellEvidence(detailHtml, job)
      if (genericShellEvidence) {
        return mergeRoleDetail(job, {
          department: null,
          employmentType: null,
          minimumQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          remoteStatus: null,
          ...genericShellEvidence,
        })
      }

      if (failOnMissingDetail) {
        throw new Error(`Leena AI PyjamaHR role page no longer exposes structured job data for ${detailUrl}`)
      }

      return job
    }

    return mergeRoleDetail(job, detail)
  }),
)

export const hasOfficialLeenaAiCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return title === 'Careers at Leena AI | Join Our Team in Agentic AI Innovation'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/leena\.ai\/careers["']/i.test(page)
    && text.includes('join our team where people power ai')
    && text.includes('see open roles')
    && text.includes('explore jobs')
    && text.includes('open roles')
  }

export const extractOpenRolesBundleUrl = (html = '') => {
  const match = String(html ?? '').match(CAREERS_BUNDLE_SCRIPT_PATTERN)
  if (!match) {
    throw new Error('Leena AI verified careers page no longer exposes the careers page bundle')
  }

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    throw new Error('Leena AI careers page bundle URL is no longer parseable')
  }
}

export const extractOpenRolesFromCareersBundle = (bundleJs = '') => {
  const seen = new Set()
  const roles = []

  for (const match of String(bundleJs ?? '').matchAll(LEENA_PYJAMAHR_ROLE_OBJECT_PATTERN)) {
    const objectSource = match[0]
    const title = extractJsStringProperty(objectSource, 'title')
    const location = extractJsStringProperty(objectSource, 'location')
    const department = extractJsStringProperty(objectSource, 'department')
    const link = normalizePyjamaHrJobUrl(extractJsStringProperty(objectSource, 'link'))
    const jobId = slugify(`${title} ${location}`)

    if (!title || !location || !link || !jobId || seen.has(jobId)) continue
    seen.add(jobId)

    roles.push({
      title,
      location,
      department,
      link,
    })
  }

  if (roles.length === 0) {
    throw new Error('Leena AI careers bundle no longer exposes the verified open roles data')
  }

  return roles
}

export const loadOpenRolesFromCareersBundle = async (careersHtml, fetchText = defaultFetchText) => {
  const bundleUrl = extractOpenRolesBundleUrl(careersHtml)
  const bundleJs = await fetchText(bundleUrl)
  return extractOpenRolesFromCareersBundle(bundleJs)
}

export const extractVisibleOpenRoles = (cards = [], { scrapedAt } = {}) => {
  const seen = new Set()

  return cards
    .map((card) => {
      const title = normalizeWhitespace(card?.title)
      const location = normalizeWhitespace(card?.location)
      const department = normalizeWhitespace(card?.department)
      const roleUrl = normalizePyjamaHrJobUrl(card?.link) || OPEN_ROLES_TAB_URL
      if (!title || !location || !isIndiaRole(location)) return null

      const jobId = slugify(`${title} ${location}`)
      if (!jobId || seen.has(jobId)) return null
      seen.add(jobId)

      return {
        title,
        company: COMPANY_NAME,
        department,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: roleUrl,
        applyUrl: roleUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
        source: SOURCE,
        link: roleUrl,
        scrapedAt,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/javascript,text/javascript,*/*;q=0.8',
  },
  label: 'leenaai-official',
  timeoutMs: 15000,
})

export const createLeenaAiScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    loadOpenRoles,
    fetchImpl,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    if (!loadOpenRoles) {
      return runCurrentOrLegacy({
        fetchText: fetchText === defaultFetchText ? undefined : fetchText,
        fetchImpl,
        signal,
        now,
        legacy: async (careersHtml, bundleJs) => {
          if (!hasOfficialLeenaAiCareersSignals(careersHtml)) {
            throw new Error('Leena AI verified official careers page no longer matches the verified public surface')
          }
          const cards = extractOpenRolesFromCareersBundle(bundleJs)
          const jobs = await enrichJobsWithPyjamaHrDetails(
            extractVisibleOpenRoles(cards, { scrapedAt: now() }),
            fetchText,
            { failOnMissingDetail: false },
          )
          signal?.throwIfAborted()
          if (jobs.length === 0) {
            throw new Error('Leena AI open roles section no longer exposes the verified public role cards')
          }
          return jobs
        },
      })
    }
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      signal?.throwIfAborted()
      throw new Error(`Leena AI API-only migration could not fetch ${CAREERS_URL}: ${error.message}`)
    }
    if (!hasOfficialLeenaAiCareersSignals(careersHtml)) {
      throw new Error('Leena AI verified official careers page no longer matches the verified public surface')
    }

    if (!loadOpenRoles) {
      loadOpenRoles = () => loadOpenRolesFromCareersBundle(careersHtml, fetchText)
    }

    const cards = await loadOpenRoles()
    const jobs = await enrichJobsWithPyjamaHrDetails(
      extractVisibleOpenRoles(cards, { scrapedAt: now() }),
      fetchText,
      { failOnMissingDetail: false },
    )

    if (jobs.length === 0) {
      throw new Error('Leena AI open roles section no longer exposes the verified public role cards')
    }

    return jobs
  },
})

export const run = async (options = {}) => createLeenaAiScraper().run(options)

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
