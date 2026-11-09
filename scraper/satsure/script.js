import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

import SATSURE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SATSURE_CATALOG
export const SOURCE = SATSURE_CATALOG.source
export const COMPANY = SATSURE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SATSURE_CATALOG.officialBrandName
export const VERIFIED_ON = SATSURE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SATSURE_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SATSURE_CATALOG.officialCareersPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SATSURE_CATALOG.officialCareersHandoffUrl
export const VERIFIED_SAMPLE_JOB_URL = SATSURE_CATALOG.verifiedSampleJobUrl
export const KEKA_BOARD_URL = SATSURE_CATALOG.jobsBoardUrl
export const CAREER_PORTAL_INFO_URL = SATSURE_CATALOG.careerPortalInfoUrl
export const ACTIVE_JOBS_URL = SATSURE_CATALOG.activeJobsUrl
export const EXPECTED_IDENTIFIER = '350ad025-b87c-4c10-940f-8f95377d5133'
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_PORTAL_DOMAIN = 'satsure.keka.com'
export const EXPECTED_PORTAL_NAME = 'SatSure Analytics India'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: KEKA_BOARD_URL,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const extractOfficialKekaHandoffUrl = (html = '') => {
  const doc = readVisibleNativeDocument(String(html ?? ''), {strict:true})
  const links = doc.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    try {
      const url = new URL(node.attrs.href, CAREERS_PAGE_URL)
      return url.origin === 'https://satsure.keka.com' && /^\/careers\/?$/.test(url.pathname)
        && !url.username && !url.password && !url.search && !url.hash ? [url.href.replace(/\/$/,'')] : []
    } catch { return [] }
  })
  const unique = [...new Set(links)]
  return unique.length === 1 ? unique[0] : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const doc = readVisibleNativeDocument(page, {strict:true})
  const normalized = normalizeWhitespace(doc.nodes(node => node.tag === 'root').map(node => doc.text(node)).join(' ')) || ''
  const heads = doc.nodes(node => node.tag === 'head')
  const titles = heads.length === 1 ? heads[0].children.filter(node => typeof node !== 'string' && node.tag === 'title' && !node.inert)
    .map(node => normalizeWhitespace(node.raw)) : []

  return titles.length === 1 && titles[0] === 'SatSure Careers | Build the Future of Earth Intelligence'
    && normalized.includes('Think Bold To Soar High')
    && normalized.includes("Let's Solve for Earth from Space")
    && normalized.includes('View Open Positions')
    && normalized.includes('SatSure Analytics India Pvt Ltd')
    && extractOfficialKekaHandoffUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const extractEmbeddedCareersDocumentPath = (html = '') =>
  String(html ?? '').match(/\/ats\/documents\/[0-9a-f-]+\/careerportal\/[^"' )]+\.html/i)?.[0] ?? null

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1] ?? ''
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_SLUG
  const identifier = normalizeWhitespace(parseQuotedConfigValue(configBlock, 'identifier'))
    || normalizeWhitespace(String(html ?? '').match(/api\/embedjobs\/js\/([0-9a-f-]+)/i)?.[1] ?? null)

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName,
  }
}

export const buildCareerPortalInfoUrl = ({ domain, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

export const hasExpectedPortalIdentity = (payload = {}) => {
  const normalizedName = normalizeWhitespace(payload.name)
  const normalizedShortName = normalizeWhitespace(payload.shortName)
  const normalizedPortalDomain = String(payload.careersPortalDomain ?? '').trim().toLowerCase()

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === EXPECTED_PORTAL_DOMAIN
}

const inventoryUnavailable = reason => Object.assign(new Error('SatSure native inventory unavailable: '+reason), {
  softFailure:true, abortRetries:true, failureKind:'upstream_inventory_unavailable',
})

const locationCountry = (location = {}) => {
  const code = normalizeWhitespace(location.countryCode)?.toUpperCase()
  const name = normalizeWhitespace(location.countryName)
  const codeCountry = nativeCountryName(code), nameCountry = nativeCountryName(name)
  if (codeCountry && nameCountry && codeCountry !== nameCountry) {
    throw inventoryUnavailable('native country fields conflict')
  }
  // Unknown typed values are not positive foreign-country evidence. A city or
  // state never fills them. Written country suffixes belong to this location.
  const label = normalizeWhitespace(location.name)
  const labelCountry = label && (label.includes(',') || /^India$/i.test(label)) ? nativeLocationCountryName(label) : null
  const typed = code && !codeCountry || name && !nameCountry ? null : codeCountry || nameCountry
  if (typed && labelCountry && typed !== labelCountry) throw inventoryUnavailable('native country and workplace conflict')
  return typed || (!code && !name ? labelCountry : null)
}
const isIndiaLocation = location => locationCountry(location) === 'India'

const descriptionWorkplace = html => {
  if (typeof html !== 'string' || !html.trim()) return null
  const doc = readVisibleNativeDocument(html, {strict:true})
  const blocks = new Set(['p','div','li'])
  const labels = doc.nodes(node => blocks.has(node.tag)
    && !node.children.some(child => typeof child !== 'string' && blocks.has(child.tag)))
    .map(node => doc.text(node).match(/^Location\s*:\s*(.{1,200})$/i)?.[1]?.trim()).filter(Boolean)
  const unique = [...new Set(labels)]
  return unique.length === 1 ? unique[0] : null
}

const descriptionText = html => {
  if (typeof html !== 'string' || !html.trim()) return null
  const doc = readVisibleNativeDocument(html, {strict:true})
  return normalizeWhitespace(doc.nodes(node => node.tag === 'root').map(node => doc.text(node)).join(' '))
}

const addUniquePart = (parts, seen, value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return

  const key = normalized.toLowerCase()
  if (seen.has(key)) return

  seen.add(key)
  parts.push(normalized)
}

const buildLocationLabel = (location = {}) => {
  const parts = []
  const seen = new Set()
  const city = normalizeWhitespace(location.city)
  const name = normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)

  addUniquePart(parts, seen, city || name)

  if (state && !/^india$/i.test(state)) {
    addUniquePart(parts, seen, state)
  }

  addUniquePart(parts, seen, locationCountry(location))

  return parts.join(', ') || null
}

const buildLocation = (locations = []) => {
  const labels = []
  const seen = new Set()

  for (const location of Array.isArray(locations) ? locations : []) {
    const label = buildLocationLabel(location)
    if (!label) continue

    const key = label.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    labels.push(label)
  }

  return labels.join('; ') || null
}

const extractPrimaryCity = (locations = []) => {
  for (const location of Array.isArray(locations) ? locations : []) {
    const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
    if (!city || /^india$/i.test(city) || /^remote$/i.test(city)) continue

    return city
  }

  return null
}

const extractPrimaryState = (locations = []) => {
  for (const location of Array.isArray(locations) ? locations : []) {
    const state = normalizeWhitespace(location.state)
    if (!state || /^india$/i.test(state)) continue

    return state
  }

  return null
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const mapJob = (job = {}, { domain } = {}) => {
  const locations = Array.isArray(job.jobLocations) ? job.jobLocations : []
  const indiaLocations = locations.filter(isIndiaLocation)
  const unknownLocations = locations.filter(location => locationCountry(location) == null)
  const retainedLocations = [...indiaLocations, ...unknownLocations]
  const hasExplicitLocations = locations.length > 0
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if ((hasExplicitLocations && retainedLocations.length === 0) || !jobId || !title || !sourceUrl || !applyUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: hasExplicitLocations ? buildLocation(retainedLocations) : descriptionWorkplace(job.description),
    city: hasExplicitLocations ? extractPrimaryCity(retainedLocations) : null,
    state: hasExplicitLocations ? extractPrimaryState(retainedLocations) : null,
    country: indiaLocations.length ? 'India' : null,
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: descriptionText(job.description),
  }
}

export const extractSearchResults = (payload, { domain } = {}) => {
  if (!Array.isArray(payload)) throw inventoryUnavailable('active feed is not a native job array')
  const seen = new Set()
  for (const job of payload) {
    if (!job || typeof job !== 'object' || Array.isArray(job)
      || !['number','string'].includes(typeof job.id) || !/^\d+$/.test(String(job.id))
      || !Number.isSafeInteger(Number(job.id)) || Number(job.id) < 1
      || typeof job.title !== 'string' || !job.title.trim() || !Array.isArray(job.jobLocations)
      || job.description != null && typeof job.description !== 'string'
      || job.jobLocations.some(location => !location || typeof location !== 'object' || Array.isArray(location)
        || ['name','city','state','countryCode','countryName'].some(key => location[key] != null && typeof location[key] !== 'string'))) {
      throw inventoryUnavailable('native role identity or workplace schema is missing or malformed')
    }
    const identity = String(Number(job.id))
    if (seen.has(identity)) throw inventoryUnavailable('duplicate native vacancy identity')
    seen.add(identity)
  }
  return payload.map(job => mapJob(job, {domain})).filter(Boolean)
}

export const createSatSureScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const read = reader => async url => {
      signal?.throwIfAborted()
      try {
        const value = await reader(url, {signal})
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const readText = read(fetchText), readJson = read(fetchJson)
    const careersHtml = await readText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified SatSure careers page changed materially')
    }

    const kekaShellHtml = await readText(OFFICIAL_CAREERS_HANDOFF_URL)
    const embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaShellHtml)
    if (!embeddedDocumentPath || !embeddedDocumentPath.includes(EXPECTED_IDENTIFIER)) {
      throw new Error('The verified SatSure Keka surface changed materially')
    }

    const embeddedCareersUrl = new URL(embeddedDocumentPath, OFFICIAL_CAREERS_HANDOFF_URL).toString()
    const careerConfig = extractCareerConfig(await readText(embeddedCareersUrl))
    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
      || normalizeDomain(careerConfig.domain) !== normalizeDomain(KEKA_BOARD_URL)
    ) {
      throw new Error('The verified SatSure Keka surface changed materially')
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!careerPortalInfoUrl || !activeJobsUrl) {
      throw new Error('Unable to build SatSure Keka endpoints')
    }

    const portalInfo = await readJson(careerPortalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('The verified SatSure Keka surface no longer matches the exact company identity')
    }

    const payload = await readJson(activeJobsUrl)
    const jobs = extractSearchResults(payload, careerConfig)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now()
    const byId = new Map(payload.map(job => [String(job.id),job]))

    const result = selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      sourceListingComplete:false,
      sourceDetailComplete:Boolean(extractActiveDescription(job.jobDescription)),
      sourceScopeComplete:false,
      lifecycleCleanupAllowed:false,
      nativeLocationEvidence:{jobLocations:byId.get(job.jobId).jobLocations,
        descriptionWorkplace:descriptionWorkplace(byId.get(job.jobId).description),
        countryQualified:Boolean(job.country),
        reason:job.country?'explicit-native-role-country':'native-role-country-unknown'},
    }))
    const audit = {source:SOURCE,observedListingCount:payload.length,reportedTotal:null,indiaFacetCount:null,
      nativeMissingWorkplaceCount:jobs.filter(job=>!job.location).length,
      nativeUnknownCountryCount:jobs.filter(job=>!job.country).length,
      extractedDetailJobs:result.filter(job=>job.sourceDetailComplete).length,
      sourceScopeComplete:false,listingPaginationComplete:null,closingInventoryMatches:null,
      reason:'Observed single public active feed; full employer and India inventory scope are unverified.'}
    if(result.length) result[0].nativeCollectionEvidence = audit
    Object.defineProperty(result,'nativeCollectionEvidence',{value:audit})
    return attachInventoryEvidence(result,{status:'coverage-gap',surface:activeJobsUrl,firstParty:true,
      listingComplete:false,pagesFetched:5,reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,
      reason:'single-active-feed-employer-scope-unverified'})
  },
})

export const run = async (options = {}) => createSatSureScraper().run(options)

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
