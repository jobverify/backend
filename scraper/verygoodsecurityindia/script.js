import {createPublicLeverSource, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'verygoodsecurityindia'
export const COMPANY = 'Very Good Security India'
export const CAREERS_URL = 'https://www.verygoodsecurity.com/careers'
export const LEVER_ACCOUNT = 'verygoodsecurity'
export const LEVER_BOARD_URL = `https://jobs.lever.co/${LEVER_ACCOUNT}`
export const LEVER_API_URL =
  `https://api.lever.co/v0/postings/${LEVER_ACCOUNT}?mode=json`
export const DISPOSITION = 'verified-first-party-careers-plus-public-lever-api'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeEntities = (value = '') => String(value)
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  return decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')) || ''

const normalizeLeverUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (url.protocol !== 'https:' || url.hostname !== 'jobs.lever.co' || url.username || url.password) return null
    if (url.pathname.split('/').filter(Boolean)[0] !== LEVER_ACCOUNT) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const isNativeCountry = code => /^[A-Z]{2}$/.test(code || '')
  && !['EU', 'EZ', 'QO', 'UN', 'XA', 'XB', 'ZZ'].includes(code) && Boolean(regionNames.of(code))
const explicitForeignCountries = new Map([['United States', 'US'], ['Canada', 'CA'], ['Greece', 'GR'], ['Poland', 'PL'], ['United Kingdom', 'GB'], ['Singapore', 'SG'], ['Australia', 'AU'], ['Germany', 'DE']].map(([name, code]) => [name.toLowerCase(), code]))
const explicitLocationCountry = place => {
  if (/^(?:India|(?:Bengaluru|Bangalore|Hyderabad|Gurugram|Gurgaon|Pune|Mumbai|Chennai|Noida)(?:,\s*India)?)$/i.test(place)) return 'IN'
  return explicitForeignCountries.get(place.toLowerCase()) || null
}

const primaryLocationCountries = payload => {
  const countries = new Map()
  for (const job of payload) {
    const primary = normalizeWhitespace(job?.categories?.location), country = normalizeWhitespace(job?.country)?.toUpperCase()
    // Generic remote labels can describe different worksites on each posting.
    // Only an exact, specific native primary label can corroborate a secondary
    // location; a posting's country never applies to all its locations.
    if (!primary || /\b(?:Remote|Global|Worldwide|Anywhere)\b/i.test(primary) || !isNativeCountry(country)) continue
    if (countries.has(primary) && countries.get(primary) !== country) throw new Error('VGS conflicting native primary location countries')
    countries.set(primary, country)
  }
  return countries
}

const indiaLocations = (job, locationCountries) => {
  const primary = normalizeWhitespace(job?.categories?.location)
  const places = Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations.map(normalizeWhitespace) : [primary]
  if (!primary || !places.length || places.some(place => !place) || !places.includes(primary)) throw new Error('VGS incomplete location inventory')
  const country = normalizeWhitespace(job.country)?.toUpperCase()
  if (country && !isNativeCountry(country)) throw new Error('VGS invalid native posting country')
  const india = []
  for (const place of places) {
    const explicitCountry = explicitLocationCountry(place)
    if (place === primary && country && explicitCountry && country !== explicitCountry) throw new Error('VGS conflicting native primary location and country')
    if (explicitCountry === 'IN') india.push(place)
    else if (explicitCountry) continue
    else if (place === primary && country && country !== 'IN') continue
    else if (place === primary && country === 'IN' && /^Remote$/i.test(place)) india.push('Remote, India')
    else if (place !== primary && locationCountries.has(place) && locationCountries.get(place) !== 'IN') continue
    else throw Object.assign(new Error('VGS incomplete location scope: ' + place), { code: 'incomplete_location_scope' })
  }
  return [...new Set(india)]
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^remote\b/i.test(normalized) || /^india$/i.test(normalized)) return null
  return normalized.split(/\s*[,/]\s*/)[0] || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const raw = String(html)
  const text = normalizeText(raw)
  return /<title[^>]*>\s*Careers\s*\|\s*VGS\s*<\/title>/i.test(raw)
    && /\bIt Takes Exceptional People to Build VGS\b/i.test(text)
    && /\bWhat We Look For In Every Teammate\b/i.test(text)
    && /\bDiscover Opportunities\b/i.test(text)
    && /href=["']#lever-jobs-container["']/i.test(raw)
    && /id=["']lever-jobs-container["']/i.test(raw)
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const raw = String(html)
  const text = normalizeText(raw)
  return /<title[^>]*>\s*VGS\s*<\/title>/i.test(raw)
    && /property=["']og:url["'][^>]+content=["']https:\/\/jobs\.lever\.co\/verygoodsecurity\/?["']/i.test(raw)
    && /\bLocation type\b/i.test(text)
    && /\bLocation\b/i.test(text)
    && /\bTeam\b/i.test(text)
    && /\bWork type\b/i.test(text)
    && /https:\/\/jobs\.lever\.co\/verygoodsecurity\/[a-z0-9-]+/i.test(raw)
    && (/\bPowered by Lever\b/i.test(text) || /(?:alt=["']Lever logo["']|lever-logo-refresh)/i.test(raw))
}

export const extractIndiaLeverJobs = (payload = []) => {
  if (!Array.isArray(payload)) {
    throw new Error('VGS invalid Lever postings payload: expected an array')
  }

  const seen = new Set()
  const locationCountries = primaryLocationCountries(payload)
  return payload.map((job) => {
    const title = normalizeWhitespace(job?.text)
    const jobId = normalizeWhitespace(job?.id)
    const sourceUrl = normalizeLeverUrl(job?.hostedUrl)
    const applyUrl = job?.applyUrl == null ? sourceUrl : normalizeLeverUrl(job.applyUrl)
    if (!title || !jobId || !/^[a-z0-9-]+$/i.test(jobId) || !sourceUrl || !applyUrl || seen.has(jobId)
      || new URL(sourceUrl).pathname !== '/' + LEVER_ACCOUNT + '/' + jobId
      || !['/' + LEVER_ACCOUNT + '/' + jobId, '/' + LEVER_ACCOUNT + '/' + jobId + '/apply'].includes(new URL(applyUrl).pathname)) {
      throw new Error('VGS invalid or duplicate Lever role identity/application')
    }
    seen.add(jobId)
    const places = indiaLocations(job, locationCountries)
    if (!places.length) return null
    const location = places.join(' / ')
    const jobDescription = normalizeText([
      job.descriptionPlain || job.description || job.descriptionBodyPlain || job.descriptionBody,
      ...(Array.isArray(job.lists) ? job.lists.map(list => [list.text, list.content].filter(Boolean).join(' ')) : []),
      job.additionalPlain || job.additional,
    ].filter(Boolean).join(' '))
    if (!jobDescription) throw new Error('VGS incomplete public job description')

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription,
      remoteStatus: toRemoteStatus(job?.workplaceType),
    }
  }).filter(Boolean)
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
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/plain,*/*' },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createVeryGoodSecurityIndiaScraper = (options = {}) => createPublicLeverSource(PUBLIC_LEVER_PROFILES.verygoodsecurityindia, options)

export const run = async (options = {}) =>
  createVeryGoodSecurityIndiaScraper().run(options)
