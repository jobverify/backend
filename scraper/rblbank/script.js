import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { RBLBANK_CATALOG } from './catalog.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RBLBANK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const JOB_LISTINGS_URL = PROVIDER_METADATA.jobListingsUrl
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH_BODY = {}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const normalizeHierarchyLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || !normalized.includes('>')) return normalized || null

  const parts = normalized
    .split('>')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) return null

  const country = nativeCountryName(parts[0])
  if (country) parts.shift()
  const deduped = parts.filter((part, index) => part !== parts[index - 1])

  if (deduped.length === 0) return country
  if (deduped.length === 1) return [deduped[0], country].filter(Boolean).join(', ')
  if (deduped.length === 2) return [deduped[1], deduped[0], country].filter(Boolean).join(', ')

  return [deduped[deduped.length - 2], deduped[deduped.length - 3], country]
    .filter(Boolean)
    .join(', ')
}

const extractCityStateLocation = (record = {}) => {
  const city = normalizeWhitespace(record.locationHierarchy)
  const hierarchy = String(record.locationHierarchyComplete ?? '')

  if (!city || !hierarchy.includes('>')) return null

  const parts = hierarchy
    .split('>')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  const country = nativeCountryName(parts[0])
  if (country) parts.shift()

  const cityIndex = parts.findIndex((part) => part?.toLowerCase() === city.toLowerCase())
  if (cityIndex <= 0) return null

  const state = parts[cityIndex - 1]
  return [city, state, country].filter(Boolean).join(', ')
}

const extractLocation = (record = {}) => firstNonEmpty(
  extractCityStateLocation(record),
  normalizeHierarchyLocation(record.locationHierarchyComplete),
  normalizeHierarchyLocation(record.locationHierarchy),
  record.location,
  record.locationName,
)

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const extractCountry = (record = {}, location = null) => {
  const countries = [record.country, record.countryName,
    String(record.locationHierarchyComplete ?? '').includes('>')
      ? String(record.locationHierarchyComplete).split('>')[0] : null]
    .map(nativeCountryName).filter(Boolean)
  const locationCountry = nativeLocationCountryName(location)
  if (locationCountry) countries.push(locationCountry)
  if (new Set(countries).size > 1) throw inventoryUnavailable('native country fields conflict')
  return countries[0] || firstNonEmpty(record.country, record.countryName)
}

const inventoryUnavailable = message => Object.assign(new Error(`RBL Bank ${message}`), {
  softFailure: true, failureKind: 'upstream_inventory_unavailable', abortRetries: true,
})

const flattenSkills = (skills = {}) => {
  if (Array.isArray(skills)) {
    return [...new Set(skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean))]
  }

  return [...new Set(
    [skills.mustTohave, skills.goodtohave]
      .flatMap((group) => Array.isArray(group) ? group : [])
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const buildApiUrl = ({ offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => (
  `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/jobs/v1?offset=${offset}&limit=${limit}`
)

export const buildJobDetailUrl = (jobCode) => (
  jobCode ? `${PORTAL_ORIGIN}/job/detail/${encodeURIComponent(jobCode)}` : null
)

export const buildPublicHeaders = () => ({
  Origin: PORTAL_ORIGIN,
  Referer: JOB_LISTINGS_URL,
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
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

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw inventoryUnavailable(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const extractPeopleStrongHandoffUrl = (html = '') => {
  const doc = readNativeDocument(html)
  return doc.nodes(node => node.tag === 'a').some(node => {
    try {
      const url = new URL(node.attrs.href, CAREERS_PAGE_URL)
      return !url.username && !url.password && url.href === JOB_LISTINGS_URL
        && Boolean(doc.text(node))
    } catch { return false }
  }) ? JOB_LISTINGS_URL : null
}

const hasNativeHeadTitle = (doc, expected) => {
  const titles = doc.nodes(node => node.tag === 'head').flatMap(head => head.children
    .filter(child => typeof child !== 'string' && !child.inert && child.tag === 'title'))
  return titles.length === 1 && normalizeWhitespace(titles[0].raw) === expected
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const doc = readNativeDocument(rawHtml)
  const normalized = doc.text(doc.nodes(node => node.tag === 'root')[0])

  return hasNativeHeadTitle(doc, 'Careers | RBL Bank')
    && normalized.includes('Join us to build a career where you can make a difference!')
    && normalized.includes('Find your Work Family')
    && extractPeopleStrongHandoffUrl(rawHtml) === JOB_LISTINGS_URL
}

export const hasPublicPortalShell = (html = '') => {
  const doc = readNativeDocument(html)
  return hasNativeHeadTitle(doc, 'Candidate Portal')
    && doc.nodes(node => node.tag === 'app-root' && node.attrs['data-testid'] === 'src-index-app-root-page-1').length === 1
    && doc.nodes(node => node.tag === 'body').some(node => (node.attrs.class || '').split(/\s+/).includes('candidate-portal'))
    && doc.nodes(node => node.tag === 'script' && node.attrs.src
      && String(node.attrs.type || '').trim().toLowerCase() === 'module').some(node => {
      try {
        const url = new URL(node.attrs.src, JOB_LISTINGS_URL)
        return url.origin === PORTAL_ORIGIN && !url.search && !url.hash && /^\/main-[A-Z0-9]+\.js$/i.test(url.pathname)
      } catch { return false }
    })
}

export const extractSearchResults = (payload = {}) => {
  if (!Array.isArray(payload.response) || payload.response.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw inventoryUnavailable('native records are missing or malformed')
  }
  const jobs = payload.response
  .map((record) => {
    const title = firstNonEmpty(record.jobTitle, record.title, record.designation, record.name)
    const jobCode = firstNonEmpty(record.jobCode, record.reqCode, record.jobId)
    const sourceUrl = firstNonEmpty(record.jobDetailUrl, buildJobDetailUrl(jobCode))
    const location = extractLocation(record)

    if (!title || !jobCode || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: firstNonEmpty(record.organizationUnit, record.department, record.departmentName),
      location,
      city: extractCity(location),
      country: extractCountry(record, location),
      jobId: firstNonEmpty(record.jobCode, record.jobId, record.requisitionId),
      requisitionId: record.requisitionId ?? firstNonEmpty(record.jobCode, record.jobId),
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: firstNonEmpty(
        record.employmentTenureType,
        record.employmentType,
        record.jobType,
      ),
      experienceRequired: firstNonEmpty(record.expRange, record.experience, record.experienceRange),
      minimumQualification: firstNonEmpty(record.minimumQualification, record.minQualification),
      preferredQualification: firstNonEmpty(record.preferredQualification, record.prefQualification),
      requiredSkills: flattenSkills(record.skills),
      postingDate: firstNonEmpty(record.jobPostedDate, record.postingDate, record.postedOn),
      closingDate: firstNonEmpty(record.jobClosureDate, record.closingDate, record.expiryDate),
      jobDescription: firstNonEmpty(record.jobDescription, record.description),
    }
  })
  .filter(Boolean)
  if (jobs.length !== payload.response.length) throw inventoryUnavailable('native role identity is missing')
  return jobs
}

export const createRblBankScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = 1000,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1) {
      throw new TypeError('RBL Bank requires positive bounded page size and page limit')
    }
    const readPage = async url => {
      signal?.throwIfAborted()
      const page = await fetchPage(url, { signal })
      signal?.throwIfAborted()
      if (page?.url !== url) throw inventoryUnavailable('public native page final URL changed')
      return page
    }
    const careersPage = await readPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw inventoryUnavailable('verified official careers page no longer matches the known public surface')
    }

    const handoffUrl = extractPeopleStrongHandoffUrl(careersPage.html)
    if (handoffUrl !== JOB_LISTINGS_URL) {
      throw inventoryUnavailable('verified official careers page no longer exposes the known PeopleStrong handoff')
    }

    const portalPage = await readPage(JOB_LISTINGS_URL)
    if (portalPage.status !== 200 || !hasPublicPortalShell(portalPage.html)) {
      throw inventoryUnavailable('verified public PeopleStrong portal no longer matches the known public surface')
    }

    const jobs = []
    let reportedTotal = null, pagesFetched = 2
    const seenPages = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      signal?.throwIfAborted()
      const payload = await fetchJson(buildApiUrl({ offset, limit: pageSize }), {
        method: 'POST',
        headers: buildPublicHeaders(),
        body: JSON.stringify(DEFAULT_SEARCH_BODY),
        signal,
      })
      signal?.throwIfAborted()
      pagesFetched += 1
      const count = payload?.totalRecords
      if (!payload || !Object.hasOwn(payload, 'response')
        || !['number', 'string'].includes(typeof count) || !/^\d+$/.test(String(count))
        || !Number.isSafeInteger(Number(count)) || Number(count) < 0
        || payload.messageCode != null && payload.messageCode.code !== 200) {
        throw inventoryUnavailable('native search envelope is missing or malformed')
      }
      reportedTotal = Number(count)
      const nativeEmpty = payload.response === null && reportedTotal === 0 && payload.messageCode?.code === 200
      const pageJobs = nativeEmpty ? [] : extractSearchResults(payload)
      if (!pageJobs.length && offset < reportedTotal) throw inventoryUnavailable('empty records contradict the reported count')
      if (pageJobs.length) {
        const identityPage = JSON.stringify(pageJobs.map(job => job.jobId))
        if (seenPages.has(identityPage)) throw inventoryUnavailable('native pagination repeated a page')
        seenPages.add(identityPage)
      }
      jobs.push(...pageJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
        sourceListingComplete: false,
      })))

      const responseCount = Array.isArray(payload?.response) ? payload.response.length : 0

      if (responseCount === 0) break
      if (responseCount < pageSize) break
      if (offset + responseCount >= reportedTotal) break
    }

    return attachInventoryEvidence(jobs, {
      status: 'discovery-only', surface: JOB_LISTINGS_URL, firstParty: true,
      listingComplete: false, pagesFetched, reportedTotal, indiaFacetCount: null,
      verifiedAt: now(), reason: 'checked-public-portal-employer-inventory-scope-unverified',
    })
  },
})

export const run = async (options = {}) => createRblBankScraper().run(options)

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
