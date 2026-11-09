import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wingify'
export const COMPANY = 'Wingify'
export const VERIFIED_ON = '2026-10-08'
export const CAREERS_URL = 'https://wingify.com/company/careers/'
export const KEKA_BOARD_URL = 'https://wingify.keka.com/careers/'
export const FIRST_PARTY_JOBS_URL = 'https://wingify.com/wp-json/api/get-active-jobs'
export const CAREER_PORTAL_INFO_URL = `${KEKA_BOARD_URL}api/organization/default/careerportalinfo`
export const ACTIVE_JOBS_URL = `${KEKA_BOARD_URL}api/jobs/default/active`
export const DISPOSITION = 'verified-first-party-keka-and-teamtailor-inventory-with-unresolved-country-scope'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 8, 2026 that the current Wingify careers feed hands off to Wingify Keka and AB Tasty Teamtailor. Complete public ATS inventories and all 31 details reconcile: 16 confirmed India, 14 explicit foreign, and Keka 136690 with conflicting Latin America/IN geography. Every returned India job is marked sourceListingComplete:false until this conflict resolves.'

export const AB_TASTY_BOARD_URL = 'https://careers.abtasty.com/jobs'
export const AB_TASTY_RSS_URL = 'https://careers.abtasty.com/jobs.rss'

export const EXPECTED_KEKA_DOMAIN = 'wingify.keka.com'
export const EXPECTED_PORTAL_NAME = 'Wingify Software Pvt. Ltd.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
  .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"').replace(/&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
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

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Wingify\s*-\s*Company Careers\s*-\s*Wingify\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/wingify\.com\/company\/careers\/["']/i.test(page)
    && /\bFind your role\b/i.test(normalized ?? '')
    && /\bOpen Positions\b/i.test(normalized ?? '')
    && /careers@wingify\.com/i.test(normalized ?? '')
    && /data-jobs-endpoint=["']https:\/\/wingify\.com\/wp-json\/api\/get-active-jobs["']/i.test(page)
}

export const extractKekaBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === KEKA_BOARD_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasKekaBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /\bWingify Software Pvt\.\s*Ltd\./i.test(normalized ?? '')
    && /\bBe a part of building something great\b/i.test(normalized ?? '')
    && /\bBrowse all jobs\b/i.test(normalized ?? '')
    && /\bKeka Hire\b/i.test(normalized ?? '')
}

export const hasExpectedPortalIdentity = (payload = {}) => {
  const name = normalizeWhitespace(payload?.name)
  const shortName = normalizeWhitespace(payload?.shortName)
  const domain = normalizeWhitespace(payload?.careersPortalDomain)
  const companyWebsite = normalizeWhitespace(payload?.companyWebsite)

  return name === EXPECTED_PORTAL_NAME
    && shortName === EXPECTED_PORTAL_NAME
    && domain === EXPECTED_KEKA_DOMAIN
    && companyWebsite === 'https://wingify.com/'
}

export const hasMatchingFirstPartyJobs = (firstPartyJobs, kekaJobs) => {
  if (!Array.isArray(firstPartyJobs) || !Array.isArray(kekaJobs)) return false
  if (firstPartyJobs.length !== kekaJobs.length) return false

  const listed = new Map()
  for (const job of firstPartyJobs) {
    const url = toAbsoluteUrl(job?.careerPortalUrl, CAREERS_URL)
    if (!url || !/^https:\/\/wingify\.keka\.com\/careers\/jobdetails\/[^/?#]+$/.test(url)) return false
    const id = url.split('/').pop()
    const title = normalizeWhitespace(job?.title)
    if (!title || listed.has(id)) return false
    listed.set(id, title)
  }

  return kekaJobs.every((job) => listed.get(String(job?.id)) === normalizeWhitespace(job?.title))
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

const isIndiaLocation = (location = {}) => {
  const countryCode = String(location.countryCode ?? '').trim().toUpperCase()
  if (countryCode === 'IN' || countryCode === 'IND') return true
  if (/^india$/i.test(String(location.countryName ?? '').trim())) return true

  return /\bindia\b/i.test(
    [location.name, location.city, location.state]
      .filter(Boolean)
      .join(' '),
  )
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

  addUniquePart(parts, seen, 'India')

  return parts.join(', ') || null
}

const buildLocation = (locations = []) => {
  const labels = []
  const seen = new Set()

  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isIndiaLocation(location)) continue

    const label = buildLocationLabel(location)
    if (!label) continue

    const key = label.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    labels.push(label)
  }

  return labels.join('; ') || null
}

const extractCity = (locations = []) => {
  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isIndiaLocation(location)) continue

    const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
    if (!city || /^india$/i.test(city) || /^remote$/i.test(city)) continue

    return city
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
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const indiaLocations = locations.filter(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (indiaLocations.length === 0 || !jobId || !title || !sourceUrl || !applyUrl) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: buildLocation(indiaLocations),
    city: extractCity(indiaLocations),
    country: 'India',
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
    jobDescription: normalizeWhitespace(job.description || job.excerpt),
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

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

const assertNotAborted = (signal) => {
  if (signal?.aborted) throw signal.reason || new Error('Wingify public inventory cancelled')
}

const inventoryError = (message) => {
  const error = new Error('Wingify ' + message)
  error.code = 'WINGIFY_INVENTORY_UNVERIFIED'
  return error
}

const parseAttribute = (html, name) => {
  const match = String(html).match(new RegExp(name + '=["\']([^"\']*)["\']', 'i'))
  return match ? decodeEntities(match[1]) : null
}

const extractDescriptionContainer = (html) => {
  const opening = /<div\b[^>]*class=["'][^"']*\bjob-description-container\b[^"']*["'][^>]*>/i.exec(html)
  if (!opening) return null
  const tags = /<\/?div\b[^>]*>/gi
  tags.lastIndex = opening.index + opening[0].length
  let depth = 1
  let match
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return html.slice(opening.index + opening[0].length, match.index)
  }
  return null
}

const validateKekaInventory = (rows) => {
  if (!Array.isArray(rows)) throw inventoryError('Keka inventory is not an array')
  const seen = new Set()
  for (const row of rows) {
    const id = String(row?.id ?? '')
    if (!/^[1-9]\d*$/.test(id) || seen.has(id) || !normalizeWhitespace(row?.title)
      || !Array.isArray(row?.jobLocations) || row.jobLocations.length === 0
      || row.jobLocations.some((location) => !location || typeof location !== 'object')
      || !normalizeWhitespace(row.description)) {
      throw inventoryError('Keka inventory has malformed, duplicate, or undescribed job identity ' + id)
    }
    seen.add(id)
  }
}

const splitFirstPartyJobs = (rows, kekaJobs) => {
  if (!Array.isArray(rows)) throw inventoryError('first-party inventory is not an array')
  const seen = new Set()
  const kekaById = new Map(kekaJobs.map((job) => [String(job.id), job]))
  const abRows = []
  for (const row of rows) {
    const url = toAbsoluteUrl(row?.careerPortalUrl, CAREERS_URL)
    const title = normalizeWhitespace(row?.title)
    if (!url || !title || seen.has(url)) throw inventoryError('first-party inventory has duplicate or invalid handoff identity')
    seen.add(url)
    const keka = /^https:\/\/wingify\.keka\.com\/careers\/jobdetails\/([1-9]\d*)$/.exec(url)
    const ab = /^https:\/\/careers\.abtasty\.com\/jobs\/([1-9]\d*)-[^/?#]+$/.exec(url)
    if (keka) {
      if (normalizeWhitespace(kekaById.get(keka[1])?.title) !== title) {
        throw inventoryError('first-party jobs endpoint no longer matches the Keka board: ' + keka[1])
      }
    } else if (ab && String(row.jobId) === ab[1]) {
      abRows.push({ id: ab[1], title, url })
    } else {
      throw inventoryError('first-party handoff inventory contains an unverified host or job identity')
    }
  }
  return abRows
}

const validateKekaDetail = (job, html) => {
  const id = String(job.id)
  const title = normalizeWhitespace(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  if (parseAttribute(html, 'selectedJobId') !== id || title !== normalizeWhitespace(job.title)
    || !/href=["']https:\/\/wingify\.com\/["']/i.test(html)
    || !/Apply for (?:the |this )?job/i.test(normalizeWhitespace(html) || '')
    || normalizeWhitespace(extractDescriptionContainer(html)) !== normalizeWhitespace(job.description)) {
    throw inventoryError('Keka detail identity or description conflict for ' + id)
  }
}

// Do not accept the domestic country code when the same published location names a foreign region.
const classifyKekaScope = (job) => {
  const locations = job.jobLocations
  const codeConflict = locations.find((location) => {
    const code = String(location.countryCode || '').trim().toUpperCase()
    const name = normalizeWhitespace(location.countryName)
    return (['IN', 'IND'].includes(code) && name && !/^india$/i.test(name))
      || (/^india$/i.test(name || '') && code && !['IN', 'IND'].includes(code))
  })
  if (codeConflict) return { scope: 'unresolved', reason: String(job.id) + ': conflicting explicit country name/code ' + codeConflict.countryName + '/' + codeConflict.countryCode }
  const conflicts = locations.filter((location) => isIndiaLocation(location)
    && /\bLatin America\b/i.test([location.name, location.city, location.state].filter(Boolean).join(' ')))
  if (conflicts.length) return { scope: 'unresolved', reason: String(job.id) + ': Latin America location conflicts with IN country code' }
  if (locations.some(isIndiaLocation)) return { scope: 'india' }
  if (locations.every((location) => /^[A-Z]{2,3}$/i.test(String(location.countryCode || '').trim())
    || (normalizeWhitespace(location.countryName) && !/^india$/i.test(location.countryName)))) return { scope: 'foreign' }
  return { scope: 'unresolved', reason: String(job.id) + ': no explicit India or foreign country scope' }
}

const rssField = (xml, name) => {
  const match = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'))
  return match ? match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1') : null
}

const parseAbTastyInventory = (boardHtml, rss) => {
  const decoded = decodeEntities(boardHtml)
  if (!/<title[^>]*>[\s\S]*?AB Tasty[\s\S]*?<\/title>/i.test(boardHtml)
    || !/Teamtailor/i.test(boardHtml) || !/"company_id":106804\b/.test(decoded)
    || !/<turbo-frame\b[^>]*id=["']jobs_list["']/i.test(boardHtml)
    || !/href=["']https:\/\/careers\.abtasty\.com\/jobs\.rss["']/i.test(boardHtml)
    || /rel=["']next["']|data-controller=["'][^"']*pagination/i.test(boardHtml)) {
    throw inventoryError('Teamtailor AB Tasty public board identity or complete inventory surface changed')
  }
  const boardUrls = new Set()
  for (const match of boardHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = toAbsoluteUrl(decodeEntities(match[1]), AB_TASTY_BOARD_URL)
    if (/^https:\/\/careers\.abtasty\.com\/jobs\/[1-9]\d*-[^/?#]+$/.test(url || '')) boardUrls.add(url)
  }
  const channel = rss.match(/<channel>([\s\S]*?)<item>/i)?.[1] || ''
  if (!/<rss\b[^>]*xmlns:tt=["']https:\/\/teamtailor\.com\/locations["']/i.test(rss)
    || normalizeWhitespace(rssField(channel, 'title')) !== 'AB Tasty'
    || normalizeWhitespace(rssField(channel, 'link')) !== AB_TASTY_BOARD_URL) {
    throw inventoryError('Teamtailor AB Tasty RSS inventory identity changed')
  }
  const records = []
  const ids = new Set()
  for (const item of rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const url = normalizeWhitespace(rssField(item[1], 'link'))
    const id = /^https:\/\/careers\.abtasty\.com\/jobs\/([1-9]\d*)-[^/?#]+$/.exec(url || '')?.[1]
    const title = normalizeWhitespace(rssField(item[1], 'title'))
    const description = normalizeWhitespace(rssField(item[1], 'description'))
    const locations = [...item[1].matchAll(/<tt:location>([\s\S]*?)<\/tt:location>/gi)]
      .map((location) => ({ city: normalizeWhitespace(rssField(location[1], 'tt:city')), country: normalizeWhitespace(rssField(location[1], 'tt:country')) }))
    if (!id || ids.has(id) || !title || !description || !boardUrls.has(url) || locations.length === 0
      || locations.some((location) => !location.country)) throw inventoryError('Teamtailor AB Tasty RSS inventory has invalid job identity or locations')
    ids.add(id)
    records.push({ id, title, description, url, locations })
  }
  const locationCounts = JSON.parse(parseAttribute(boardHtml, 'data-blocks--jobs-locations-value') || 'null')
  if (!Array.isArray(locationCounts) || locationCounts.some((location) => !Number.isInteger(location.count) || location.count < 0)
    || locationCounts.reduce((sum, location) => sum + location.count, 0) !== records.reduce((sum, job) => sum + job.locations.length, 0)
    || records.length !== boardUrls.size) throw inventoryError('Teamtailor AB Tasty board and RSS complete inventories disagree')
  return records
}

const COUNTRY_CODES = { 'United Kingdom': 'GB', France: 'FR', Germany: 'DE', India: 'IN' }

const validateAbTastyDetail = (record, html) => {
  const postings = []
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed
    try { parsed = JSON.parse(script[1]) } catch { throw inventoryError('Teamtailor AB Tasty detail has invalid JSON-LD: ' + record.id) }
    for (const value of Array.isArray(parsed) ? parsed : [parsed]) if (value?.['@type'] === 'JobPosting') postings.push(value)
  }
  const posting = postings[0]
  const locations = Array.isArray(posting?.jobLocation) ? posting.jobLocation : [posting?.jobLocation]
  const expectedCountries = record.locations.map((location) => COUNTRY_CODES[location.country]).sort()
  const actualCountries = locations.map((location) => location?.address?.addressCountry).sort()
  const applyUrl = parseAttribute(html, 'data-careersite--jobs--form-overlay-job-application-url-value')
  if (postings.length !== 1 || String(posting?.identifier?.value) !== record.id
    || normalizeWhitespace(posting?.identifier?.name) !== 'AB Tasty'
    || normalizeWhitespace(posting?.title) !== record.title
    || normalizeWhitespace(posting?.hiringOrganization?.name) !== 'AB Tasty'
    || posting?.hiringOrganization?.sameAs !== 'https://careers.abtasty.com'
    || parseAttribute(html, 'data-careersite--jobs--form-overlay-job-id-value') !== record.id
    || applyUrl !== record.url + '/applications/new'
    || normalizeWhitespace(posting?.description) !== record.description
    || expectedCountries.some((country) => !country) || JSON.stringify(expectedCountries) !== JSON.stringify(actualCountries)
    || locations.some((location) => !normalizeWhitespace(location?.address?.addressLocality))) {
    throw inventoryError('Teamtailor AB Tasty detail identity, description, or country conflict for ' + record.id)
  }
  return { ...record, posting, locations, applyUrl, scope: actualCountries.includes('IN') ? 'india' : 'foreign' }
}

const mapAbTastyJob = (detail) => {
  const india = detail.locations.filter((location) => location.address.addressCountry === 'IN')
  return {
    title: detail.title, company: COMPANY, department: null,
    location: india.map((location) => location.address.addressLocality + ', India').join('; '),
    city: india[0].address.addressLocality, country: 'India',
    jobId: 'abtasty-' + detail.id, requisitionId: detail.id,
    sourceUrl: detail.url, applyUrl: detail.applyUrl,
    employmentType: detail.posting.employmentType === 'FULL_TIME' ? 'Full Time' : null,
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: normalizePostingDate(detail.posting.datePosted), closingDate: null, jobDescription: detail.description,
  }
}

export const createWingifyScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString(), signal } = {}) {
    const getText = async (url) => { assertNotAborted(signal); const result = await fetchText(url, { signal }); assertNotAborted(signal); return String(result) }
    const getJson = async (url) => { assertNotAborted(signal); const result = await fetchJson(url, { signal }); assertNotAborted(signal); return result }
    const careersHtml = await getText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml) || extractKekaBoardUrl(careersHtml) !== KEKA_BOARD_URL) {
      throw inventoryError('verified official careers handoff changed materially')
    }
    const kekaBoardHtml = await getText(KEKA_BOARD_URL)
    if (!hasKekaBoardSignal(kekaBoardHtml)) throw inventoryError('verified Keka board shell changed materially')
    if (!hasExpectedPortalIdentity(await getJson(CAREER_PORTAL_INFO_URL))) throw inventoryError('Keka portal no longer resolves to the exact company identity')
    const firstPartyJobs = await getJson(FIRST_PARTY_JOBS_URL)
    const activeJobs = await getJson(ACTIVE_JOBS_URL)
    // Check the published handoff before using either independent complete ATS inventory.
    const firstPartyAb = splitFirstPartyJobs(firstPartyJobs, Array.isArray(activeJobs) ? activeJobs : [])
    validateKekaInventory(activeJobs)
    if (firstPartyAb.length === 0) throw inventoryError('first-party AB Tasty handoff inventory is absent; current combined inventory cannot be verified')
    const conflicts = []
    const indiaJobs = []
    for (const job of activeJobs) {
      validateKekaDetail(job, await getText(buildJobDetailUrl({ domain: KEKA_BOARD_URL, jobId: job.id })))
      const scope = classifyKekaScope(job)
      if (scope.scope === 'unresolved') conflicts.push(scope.reason)
      if (scope.scope === 'india') indiaJobs.push(mapJob(job, { domain: KEKA_BOARD_URL }))
    }
    let abJobs = []
    if (firstPartyAb.length) {
      if (!/AB Tasty and VWO have united/i.test(normalizeWhitespace(careersHtml) || '')) throw inventoryError('first-party AB Tasty handoff authority changed')
      const boardHtml = await getText(AB_TASTY_BOARD_URL)
      abJobs = parseAbTastyInventory(boardHtml, await getText(AB_TASTY_RSS_URL))
      const byUrl = new Map(abJobs.map((record) => [record.url, record]))
      if (firstPartyAb.some((record) => byUrl.get(record.url)?.title !== record.title || byUrl.get(record.url)?.id !== record.id)) {
        throw inventoryError('first-party AB Tasty inventory no longer reconciles with its public Teamtailor board')
      }
      for (const record of abJobs) {
        const detail = validateAbTastyDetail(record, await getText(record.url))
        if (detail.scope === 'india') indiaJobs.push(mapAbTastyJob(detail))
      }
    }
    if (conflicts.length && indiaJobs.length === 0) throw inventoryError('country scope remains unresolved and no independently verified India inventory is available: ' + conflicts.join('; '))
    const complete = conflicts.length === 0
    const verifiedAt = now()
    const jobs = indiaJobs.map((job) => ({ ...job, source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt: verifiedAt, sourceListingComplete: complete }))
    return attachInventoryEvidence(jobs, {
      status: complete ? 'complete-inventory' : 'coverage-gap', surface: CAREERS_URL,
      firstParty: true, listingComplete: complete, pagesFetched: firstPartyAb.length ? 3 : 2,
      reportedTotal: activeJobs.length + abJobs.length, indiaFacetCount: complete ? jobs.length : null,
      verifiedAt, reason: complete ? 'Complete public Keka and first-party-linked Teamtailor inventories and all job details reconciled.'
        : 'Verified India jobs only; full source India inventory is incomplete because of unresolved upstream geography: ' + conflicts.join('; '),
    })
  },
})

export const run = async (options = {}) => createWingifyScraper().run(options)

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
