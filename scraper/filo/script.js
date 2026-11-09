import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'filo'
export const COMPANY = 'Filo'
export const OFFICIAL_BRAND = 'Filo'
export const VERIFIED_ON = '2026-10-09'
export const CAREERS_URL = 'https://askfilo.com/careers'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-public-role-details'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on October 9, 2026 that https://askfilo.com/careers publishes 17 unique current roles in its department-grouped public payload. All 17 public detail pages matched their listing identities, known India locations, full descriptions and 17 unique native application URLs. A newly published Jammu and Kashmir role is recognized at state level without inventing a city. The previous Google Docs payload remains supported for historical compatibility."

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_CAREERS_PAGE_PATTERNS = [
  /<title[^>]*>\s*Job Opportunities At Filo\. Check For Recent Career Options\s*<\/title>/i,
  /\bCareer at Filo\b/i,
  /\bJOIN OUR TEAM\b/i,
  /\bDepartments\b/i,
  /\bid="__NEXT_DATA__"/i,
  /\bFilo EdTech INC\.\s*2025\b/i,
]

const TRUSTED_GOOGLE_DOC_URL_PATTERN =
  /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/e\/[^/?#]+\/pub(?:[?#].*)?$/i

const DOC_PUBLISH_SIGNAL_PATTERN = /\bPublished using Google Docs\b/i

const decodeHtmlEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value = '') =>
  normalizeWhitespace(
    decodeHtmlEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const slugify = (value = '') =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  || null

const extractNextDataJson = (html = '') =>
  String(html).match(
    /<script[^>]+id="__NEXT_DATA__"[^>]+type="application\/json"[^>]*>\s*([\s\S]*?)\s*<\/script>/i,
  )?.[1] || null

const parseCareersPayload = (html = '') => {
  const rawJson = extractNextDataJson(html)
  if (!rawJson) {
    throw new Error('Filo verified careers payload changed materially')
  }

  try {
    return JSON.parse(rawJson)
  } catch {
    throw new Error('Filo verified careers payload changed materially')
  }
}

const isTrustedGoogleDocUrl = (value = '') =>
  TRUSTED_GOOGLE_DOC_URL_PATTERN.test(normalizeWhitespace(value) || '')

const CURRENT_APPLY_URL_PATTERN =
  /^https:\/\/filorians\.tools\.findfilo\.com\/hiring\/apply\/\d+\/?$/i

const CURRENT_INDIA_LOCATION_PATTERN =
  /^(?:Gurgaon|Gurugram|Jharkhand|Assam|Jammu and Kashmir|Maharasthra|Maharashtra|Jaipur \(Rajasthan\)|Punjab\/Haryana|Kerala|Bihar)$/i

const buildCurrentDetailUrl = (slug) =>
  `${CAREERS_URL}/${Buffer.from(slug).toString('base64')}`

const dedupeRoles = (roles = []) =>
  roles.filter((role, index, collection) =>
    collection.findIndex((candidate) =>
      candidate.title === role.title
      && candidate.department === role.department
      && candidate.documentUrl === role.documentUrl) === index)

const extractSection = (text = '', startLabel, endLabels = []) => {
  const normalized = normalizeWhitespace(text) || ''
  if (!normalized) return null

  const endPattern = endLabels.length > 0
    ? `(?=${endLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|$)`
    : '$'
  const expression = new RegExp(
    `${startLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\s\\S]*?)${endPattern}`,
    'i',
  )
  const match = normalized.match(expression)
  return normalizeWhitespace(match?.[1])
}

const extractDocContentHtml = (html = '') =>
  String(html).match(/<div id="contents">([\s\S]*?)(?:<\/body>|<script\b)/i)?.[1] || html

const extractDocTitle = (html = '') =>
  normalizeWhitespace(
    String(html).match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    || String(html).match(/<div id="title">([\s\S]*?)<\/div>/i)?.[1],
  )

const normalizeRoleComparisonText = (value = '') =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  || null

const singularizeToken = (token = '') => {
  if (token.endsWith('ies') && token.length > 3) {
    return `${token.slice(0, -3)}y`
  }

  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) {
    return token.slice(0, -1)
  }

  return token
}

const tokenizeRoleTitle = (value = '') => [
  ...new Set(
    (normalizeRoleComparisonText(value) || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => singularizeToken(token)),
  ),
]

const isTokenSubset = (candidateTokens = [], referenceTokens = []) =>
  candidateTokens.length > 0
  && candidateTokens.every((token) => referenceTokens.includes(token))

export const hasMatchingRoleTitle = (documentTitle = '', listingTitle = '') => {
  const normalizedDocumentTitle = normalizeRoleComparisonText(documentTitle)
  const normalizedListingTitle = normalizeRoleComparisonText(listingTitle)

  if (!normalizedDocumentTitle || !normalizedListingTitle) {
    return false
  }

  if (normalizedDocumentTitle === normalizedListingTitle) {
    return true
  }

  if (
    normalizedDocumentTitle.includes(normalizedListingTitle)
    || normalizedListingTitle.includes(normalizedDocumentTitle)
  ) {
    return true
  }

  const documentTokens = tokenizeRoleTitle(normalizedDocumentTitle)
  const listingTokens = tokenizeRoleTitle(normalizedListingTitle)

  return isTokenSubset(documentTokens, listingTokens)
    || isTokenSubset(listingTokens, documentTokens)
}

const extractExperienceRequired = (text = '') => {
  const normalized = normalizeWhitespace(text) || ''
  const scoped = extractSection(normalized, 'Experience:', [
    'About Filo',
    'Roles and Responsibilities',
    'Requirements',
    'What we offer',
    'Join In',
  ]) || normalized

  const match = scoped.match(/\b(?:Minimum\s+)?\d+(?:\s*-\s*\d+|\+)?\s*years?\b/i)
  return normalizeWhitespace(match?.[0])
}

export const hasOfficialCareersPageSignal = (html = '') =>
  REQUIRED_CAREERS_PAGE_PATTERNS.every((pattern) => pattern.test(String(html)))

export const extractPublicRoles = (html = '') => {
  const payload = parseCareersPayload(html)
  const departmentMap = payload?.props?.pageProps?.data

  if (Array.isArray(departmentMap)) {
    const groupedRoles = []
    const allDepartmentIds = new Set()
    const groupedIds = new Set()
    for (const department of departmentMap) {
      if (
        !Number.isInteger(department?.departmentId)
        || !normalizeWhitespace(department?.departmentName)
        || !Array.isArray(department?.jobs)
      ) {
        throw new Error('Filo verified careers payload changed materially')
      }
      for (const entry of department.jobs) {
        if (
          !Number.isInteger(entry?.id)
          || entry.id <= 0
          || !normalizeWhitespace(entry?.jobTitle)
          || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.slug || '')
        ) {
          throw new Error('Filo verified careers payload changed materially')
        }
        if (department.departmentId === 0) {
          allDepartmentIds.add(entry.id)
          continue
        }
        if (groupedIds.has(entry.id)) {
          throw new Error('Filo verified careers payload changed materially')
        }
        groupedIds.add(entry.id)
        groupedRoles.push({
          kind: 'current',
          id: entry.id,
          title: normalizeWhitespace(entry.jobTitle),
          department: normalizeWhitespace(department.departmentName),
          departmentId: department.departmentId,
          slug: entry.slug,
          detailUrl: buildCurrentDetailUrl(entry.slug),
        })
      }
    }
    if (
      allDepartmentIds.size > 0
      && (allDepartmentIds.size !== groupedIds.size
        || [...allDepartmentIds].some((id) => !groupedIds.has(id)))
    ) {
      throw new Error('Filo verified careers payload changed materially')
    }
    return groupedRoles
  }

  if (!departmentMap || typeof departmentMap !== 'object') {
    throw new Error('Filo verified careers payload changed materially')
  }

  const roles = []

  for (const [departmentName, entries] of Object.entries(departmentMap)) {
    if (!Array.isArray(entries)) {
      throw new Error('Filo verified careers payload changed materially')
    }

    for (const entry of entries) {
      const title = normalizeWhitespace(entry?.position)
      const department = normalizeWhitespace(entry?.department)
      const documentUrl = normalizeWhitespace(entry?.documentUrl)

      if (!title || !department || !documentUrl) {
        throw new Error('Filo verified careers payload changed materially')
      }
      if (department !== normalizeWhitespace(departmentName)) {
        throw new Error('Filo verified careers payload changed materially')
      }
      if (!isTrustedGoogleDocUrl(documentUrl)) {
        throw new Error('Filo public role document contract changed materially')
      }

      roles.push({
        title,
        department,
        documentUrl,
      })
    }
  }

  const dedupedRoles = dedupeRoles(roles)
  if (dedupedRoles.length === 0) {
    throw new Error('Filo verified careers payload changed materially')
  }

  return dedupedRoles
}

export const extractPublishedRoleDetails = (html = '', listing = {}) => {
  if (!DOC_PUBLISH_SIGNAL_PATTERN.test(String(html))) {
    throw new Error('Filo published Google Doc detail page changed materially')
  }

  const title = extractDocTitle(html)
  if (!title || !hasMatchingRoleTitle(title, normalizeWhitespace(listing?.title))) {
    throw new Error('Filo published Google Doc detail page changed materially')
  }

  const text = stripHtml(extractDocContentHtml(html)) || ''
  const jobDescription = extractSection(text, 'Roles and Responsibilities', [
    'Requirements',
    'What we offer',
    'Join In',
  ])
  const minimumQualification = extractSection(text, 'Requirements', [
    'What we offer',
    'Join In',
    'Website:',
  ])

  return {
    title,
    experienceRequired: extractExperienceRequired(text),
    jobDescription,
    minimumQualification,
  }
}

export const extractCurrentRoleDetails = (html = '', listing = {}) => {
  const payload = parseCareersPayload(html)?.props?.pageProps?.data
  const title = normalizeWhitespace(payload?.job_title)
  const description = normalizeWhitespace(payload?.job_description)
  const applyUrl = normalizeWhitespace(payload?.apply_link)
  if (
    payload?.id !== listing.id
    || payload?.department_id !== listing.departmentId
    || payload?.slug !== listing.slug
    || title !== listing.title
    || payload?.is_deleted !== false
    || !description
    || !CURRENT_APPLY_URL_PATTERN.test(applyUrl || '')
  ) {
    throw new Error('Filo current role detail changed materially')
  }

  const location = normalizeWhitespace(payload.location)
    || normalizeWhitespace(
      payload.job_description.match(/^(?:-\s*)?\*\*Job Location:\*\*\s*([^\r\n]+)/im)?.[1]
        ?.replace(/\*+\s*$/, ''),
    )
  if (!CURRENT_INDIA_LOCATION_PATTERN.test(location || '')) {
    throw Object.assign(new Error('Filo current role has unverified India location'),{nativeLocationScopeUnverified:true})
  }
  const experienceRequired = normalizeWhitespace(
    payload.job_description.match(/^(?:-\s*)?\*\*Experience:\*\*\s*([^\r\n]+)/im)?.[1],
  )
  const employmentType = normalizeWhitespace(
    payload.job_description.match(/^(?:-\s*)?\*\*Job Type:\*\*\s*([^\r\n]+)/im)?.[1],
  )
  const postingDate = /^\d{4}-\d{2}-\d{2}T/.test(payload.created_at || '')
    ? payload.created_at.slice(0, 10)
    : null

  return {
    location,
    city: /^(?:Gurgaon|Gurugram)/i.test(location)
      ? location
      : /^Jaipur \(Rajasthan\)$/i.test(location) ? 'Jaipur' : null,
    applyUrl,
    experienceRequired,
    employmentType,
    postingDate,
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const buildJob = (listing = {}, detail = {}, scrapedAt = new Date().toISOString()) => {
  const jobId = slugify(listing.title)

  return {
    title: listing.title,
    company: COMPANY,
    department: listing.department,
    location: null,
    city: null,
    // The public listing and role document omit role-level country evidence.
    country: null,
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.documentUrl,
    applyUrl: listing.documentUrl,
    employmentType: null,
    experienceRequired: detail.experienceRequired || null,
    minimumQualification: detail.minimumQualification || null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: detail.jobDescription || null,
    source: SOURCE,
    link: listing.documentUrl,
    scrapedAt,
  }
}

const buildCurrentJob = (listing, detail, scrapedAt) => ({
  title: listing.title,
  company: COMPANY,
  department: listing.department,
  location: detail.location,
  city: detail.city,
  country: 'India',
  jobId: String(listing.id),
  requisitionId: String(listing.id),
  sourceUrl: listing.detailUrl,
  applyUrl: detail.applyUrl,
  employmentType: detail.employmentType,
  experienceRequired: detail.experienceRequired,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: detail.postingDate,
  closingDate: null,
  jobDescription: detail.jobDescription,
  source: SOURCE,
  link: listing.detailUrl,
  scrapedAt,
})

export const createFiloScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Filo verified official careers surface changed materially')
    }

    const roles = extractPublicRoles(careersHtml)
    const selectedRoles = Number.isInteger(maxJobs)
      ? roles.slice(0, maxJobs)
      : roles
    const scrapedAt = now()
    const jobs = []
    const unqualifiedLocationIds=[]
    const currentApplications = new Map()

    for (const listing of selectedRoles) {
      if (listing.kind === 'current') {
        const detailHtml = await fetchText(listing.detailUrl)
        let detail
        try{detail=extractCurrentRoleDetails(detailHtml,listing)}catch(error){
          if(error.nativeLocationScopeUnverified===true){unqualifiedLocationIds.push(String(listing.id));continue}
          throw error
        }
        const prior = currentApplications.get(detail.applyUrl)
        if (prior) {
          if (
            prior.title !== listing.title
            || prior.department !== listing.department
            || prior.location !== detail.location
          ) {
            throw new Error('Filo duplicate application role details conflict')
          }
          continue
        }
        const job = buildCurrentJob(listing, detail, scrapedAt)
        currentApplications.set(detail.applyUrl, job)
        jobs.push(job)
        continue
      }
      try {
        const detailHtml = await fetchText(listing.documentUrl)
        const detail = extractPublishedRoleDetails(detailHtml, listing)
        jobs.push(buildJob(listing, detail, scrapedAt))
      } catch (error) {
        console.warn(`  [${SOURCE}] Skipping ${listing.title}: ${error.message}`)
      }
    }

    if(unqualifiedLocationIds.length){
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
        observedVacancyCount:roles.length,retainedIndiaRoleCount:jobs.length,unqualifiedLocationIds},configurable:true})
      return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,
        pagesFetched:selectedRoles.length+1,reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,
        reason:'current-native-full-role-criteria;unverified-worksite-country-ids:'+unqualifiedLocationIds.join(',')})
    }
    return jobs
  },
})

export const run = async (options = {}) => createFiloScraper(options).run(options)

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
