import { loadConfig } from '../utils/loadConfig.js'
import { fetchTextWithRetry, fetchJsonWithRetry } from '../utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { extractActiveDescription } from '../utils/activeNativeHtml.js'
import { nativeDetailReceiptKey, readNativeDetailReceipt, rememberNativeDetailReceipt, nativeDetailPassBudget, currentNativeDetailRecovery } from '../utils/nativeDetailRecovery.js'

const DEFAULT_FETCH_TIMEOUT_MS = 15000
const DEFAULT_LISTING_BUDGET_MS = 120000
const DEFAULT_DETAIL_BUDGET_MS = 30000
const MAX_DEFAULT_DETAIL_BUDGET_MS = 120000
const DEFAULT_DETAIL_WORKER_WAVE_ALLOWANCE_MS = 1000
// These names are independently published equivalents, not geography lookups.
// MHA/PIB relid=113433: Belgaum/Belagavi, Hubli/Hubballi (Karnataka).
// trivandrum.nic.in/en/about-district/: Trivandrum/Thiruvananthapuram.
const REVIEWED_INDIA_CITY_NAMES = [
  { states: ['karnataka'], names: ['belgaum', 'belagavi'] },
  { states: ['karnataka'], names: ['hubli', 'hubballi'] },
  { states: ['kerala', 'keralam'], names: ['trivandrum', 'thiruvananthapuram'] },
]
const nonnegativeBudget = (value, fallback) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
const incompleteSnapshot = message => Object.assign(new Error('PHENOM_INCOMPLETE_SNAPSHOT: ' + message), { code: 'PHENOM_INCOMPLETE_SNAPSHOT' })
const requestWithSignal = async (fetcher, url, signal, requestOptions = {}) => {
  signal?.throwIfAborted()
  let onAbort
  const aborted = signal && new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const request = Promise.resolve().then(() => { signal?.throwIfAborted(); return fetcher(url, { ...requestOptions, signal }) })
    return await (aborted ? Promise.race([request, aborted]) : request)
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
    signal?.throwIfAborted()
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

// Overriding a contradictory optional title needs a substantial authored body,
// not merely nonempty markup, a section label, or an application prompt.
const hasSubstantiveNativeDescription = value => {
  const content = extractActiveDescription(value)
  return Boolean(content && content.length >= 200 && (content.match(/\p{L}[\p{L}\p{N}'_-]*/gu) || []).length >= 30)
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(value)
  return match ? transform(match) : null
}

const EXPERIENCE_KEYWORD_PATTERN = /\b(?:experience|experienced|exp\.?)\b/i
const EXPERIENCE_DURATION_PATTERN = /\b(?:\d+(?:\.\d+)?\+?\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr))\b/i
const EXPERIENCE_LABEL_MAP = new Map([
  ['no experience required', 'No experience required'],
  ['fresher', 'Fresher'],
  ['freshers', 'Fresher'],
  ['experienced', 'Experienced'],
  ['experienced professional', 'Experienced Professional'],
  ['entry level', 'Entry Level'],
  ['intern', 'Intern'],
  ['internship', 'Internship'],
  ['junior', 'Junior'],
  ['associate', 'Associate'],
  ['mid level', 'Mid Level'],
  ['mid-level', 'Mid Level'],
  ['mid senior level', 'Mid-Senior level'],
  ['mid-senior level', 'Mid-Senior level'],
  ['senior', 'Senior'],
])

const extractJsonObjectAfterMarker = (value, marker) => {
  const source = String(value)
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null

  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escapeNext) {
        escapeNext = false
      } else if (char === '\\') {
        escapeNext = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return null
}

// Read only active native elements. Scripts inside templates, comments and raw
// text elements cannot establish listing identity or supply a job description.
const nativeElements = value => {
  const html = String(value), scripts = [], links = []
  const tags = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  let templateDepth = 0, match
  while ((match = tags.exec(html))) {
    if (!match[1]) continue
    const name = match[1].toLowerCase(), closing = match[0].startsWith('</')
    if (name === 'template') { templateDepth = Math.max(0, templateDepth + (closing ? -1 : 1)); continue }
    if (closing) continue
    const attributes = new Map()
    for (const attr of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = attr[1].toLowerCase()
      // Duplicate native identity attributes are ambiguous, even if a browser
      // might select the first one.
      attributes.set(key, attributes.has(key) ? null : decodeHtmlEntities(attr[2] ?? attr[3] ?? attr[4] ?? ''))
    }
    if (raw.has(name)) {
      if (name === 'plaintext') break
      const close = new RegExp('</' + name + '\\s*>', 'gi')
      close.lastIndex = tags.lastIndex
      const end = close.exec(html)
      if (!end) break
      if (name === 'script' && templateDepth === 0 && !attributes.has('src') && !attributes.has('nomodule')) {
        const type = (attributes.get('type') ?? (attributes.has('type') ? 'invalid' : '')).trim().toLowerCase()
        scripts.push({ type, body: html.slice(tags.lastIndex, end.index) })
      }
      tags.lastIndex = close.lastIndex
      continue
    }
    if (name === 'link' && templateDepth === 0) links.push(attributes)
  }
  return { scripts, links }
}

export const extractNativeModel = (html, marker) => {
  const models = []
  for (const { type, body } of nativeElements(html).scripts) {
    if (!['', 'text/javascript', 'application/javascript', 'module'].includes(type)) continue
    // Preserve offsets while masking JS comments and quoted values. A marker
    // appearing in a stale string or a comment is not an assignment.
    const code = body.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*|<!--[^\r\n]*/g,
      value => value.replace(/[^\r\n]/g, ' '))
    const pattern = marker === 'ddo'
      ? /\bphApp\s*\.\s*ddo\s*=\s*(?=\{)/g
      : /\bvar\s+phApp\s*=\s*phApp\s*\|\|\s*(?=\{)/g
    for (const assignment of code.matchAll(pattern)) {
      const previous = code.slice(0, assignment.index).trim().at(-1)
      if (previous && !';{}'.includes(previous)) continue
      const json = extractJsonObjectAfterMarker(body.slice(assignment.index + assignment[0].length), '')
      const model = parseJson(json)
      if (!model) throw incompleteSnapshot('invalid active native model')
      models.push(model)
    }
  }
  const unique = new Map(models.map(model => [JSON.stringify(model), model]))
  if (unique.size > 1) throw incompleteSnapshot('conflicting active native models')
  return unique.values().next().value || null
}

const extractCanonical = html => {
  const urls = nativeElements(html).links.filter(attrs => attrs.get('rel')?.toLowerCase().split(/\s+/).includes('canonical'))
    .map(attrs => attrs.get('href'))
  if (urls.some(url => typeof url !== 'string') || new Set(urls).size > 1) throw incompleteSnapshot('conflicting native canonical links')
  return urls[0] || null
}

const parseJson = (value) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const knownCountries = new Map()
for (let first = 65; first <= 90; first += 1) for (let second = 65; second <= 90; second += 1) {
  const code = String.fromCharCode(first, second), name = regionNames.of(code)
  if (name !== code && !['ZZ', 'EU', 'EZ', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    knownCountries.set(code.toLowerCase(), code)
    knownCountries.set(name.toLowerCase(), code)
  }
}
for (const [name, code] of Object.entries({ 'united states of america': 'US', usa: 'US',
  uk: 'GB', 'great britain': 'GB', 'czech republic': 'CZ', 'south korea': 'KR',
  'bosnia and herzegovina': 'BA', 'republic of korea': 'KR', 'korea, republic of': 'KR', 'hong kong': 'HK', 'russian federation': 'RU', 'viet nam': 'VN', 'taiwan, china': 'TW', turkey: 'TR' })) {
  knownCountries.set(name, code)
}

// Fixed ISO 3166-1 alpha-3 pairs observed on the OpenText public board.
// Reference: https://unstats.un.org/unsd/methodology/m49/overview
// These codes are enabled only by the reviewed source option below.
const isoAlpha3CountryRegions = new Map(Object.entries({
  "ARE": "AE",
  "AUS": "AU",
  "AUT": "AT",
  "BEL": "BE",
  "BGR": "BG",
  "BRA": "BR",
  "CAN": "CA",
  "CHE": "CH",
  "CZE": "CZ",
  "DEU": "DE",
  "ESP": "ES",
  "FIN": "FI",
  "FRA": "FR",
  "GBR": "GB",
  "IND": "IN",
  "IRL": "IE",
  "ITA": "IT",
  "JPN": "JP",
  "KOR": "KR",
  "MYS": "MY",
  "NLD": "NL",
  "PHL": "PH",
  "ROU": "RO",
  "SGP": "SG",
  "TUR": "TR",
  "USA": "US",
  "ZAF": "ZA"
}))

const normalizeAggregationMap = (aggregations = []) => Object.fromEntries(
  aggregations
    .filter((item) => item?.field)
    .map((item) => [item.field, item.value || {}]),
)

const normalizeExperienceLabel = (value) => {
  const text = stripTags(value)
  if (!text) return null
  const normalized = normalizeWhitespace(text)
    ?.replace(/[.:;,\s-]+$/g, '')
    .toLowerCase()

  return normalized ? EXPERIENCE_LABEL_MAP.get(normalized) || null : null
}

const normalizeExperienceDuration = (value) => normalizeWhitespace(value)
  ?.replace(/\s*\+\s*(?=[a-z])/gi, '+ ')
  .replace(/\s*-\s*/g, ' - ')
  .replace(/\s*\bto\b\s*/gi, ' to ')
  .replace(/\b(?:yr|year)\b/gi, 'year')
  .replace(/\b(?:yrs|years)\b/gi, 'years')
  .replace(/\b(?:mo|month)\b/gi, 'month')
  .replace(/\b(?:mos|months)\b/gi, 'months')

const extractExperienceDuration = (value, { requireKeyword = true } = {}) => {
  const text = stripTags(value)
  if (!text) return null
  const normalizedText = text.replace(
    /(\d+(?:\.\d+)?)\s+\+\s*(?=(?:months?|mos?|mo|years?|yrs?|yr)\b)/gi,
    '$1+ ',
  )
    .replace(/[\u2013\u2014\u2212]/g, '-')
  if (requireKeyword) {
    const contextualMatch = (
      normalizedText.match(
        /\b((?:\d+(?:\.\d+)?\+?\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)))(?:\s+of)?(?:\s+[a-z0-9/&()-]+){0,8}\s+(?:experience|experienced|exp\.?)\b/i,
      )
      || normalizedText.match(
        /\b(?:experience|experienced|exp\.?)\b[^.]{0,80}?\b((?:\d+(?:\.\d+)?\+?\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)))\b/i,
      )
    )
    if (contextualMatch) {
      return normalizeExperienceDuration(contextualMatch[1])
    }

    const sectionHeadingMatch = normalizedText.match(
      /\bexperience(?:\s*&\s*[a-z]+)?\b[^0-9]{0,40}\b((?:\d+(?:\.\d+)?\+?\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)))\b/i,
    )
    if (sectionHeadingMatch) {
      return normalizeExperienceDuration(sectionHeadingMatch[1])
    }

    const leadingTitleDurationMatch = normalizedText.match(
      /^[^.]{0,160}?\(\s*((?:\d+(?:\.\d+)?\+?\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)\s*(?:-|to)\s*\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)|\d+(?:\.\d+)?\+?\s*(?:months?|mos?|mo|years?|yrs?|yr)))\s*\)/i,
    )
    if (leadingTitleDurationMatch) {
      return normalizeExperienceDuration(leadingTitleDurationMatch[1])
    }

    return null
  }

  const matched = normalizedText.match(EXPERIENCE_DURATION_PATTERN)
  return matched ? normalizeExperienceDuration(matched[0]) : null
}

const extractExperienceSnippet = (value, { requireKeyword = true, allowLabels = false } = {}) => {
  const duration = extractExperienceDuration(value, { requireKeyword })
  if (duration) return duration
  return allowLabels ? normalizeExperienceLabel(value) : null
}

// A native display sentence can describe a preference or an alternative path.
// Only a complete standalone experience field can be promoted to a requirement;
// keep sentences in the original description for the policy's contextual parser.
const REQUIRED_EXPERIENCE_FIELD = new RegExp('^(?:(?:minimum(?: of)?|at least)\\s+)?(?:'
  + EXPERIENCE_DURATION_PATTERN.source + ')(?:\\s+(?:of\\s+)?(?:(?:professional|relevant|work)\\s+)*experience)?'
  + '(?:\\s+(?:is\\s+)?(?:required|mandatory))?\\.?$', 'i')
const nativeExperienceRequirement = value => {
  const text = normalizeWhitespace(value)
  return normalizeExperienceLabel(text) || (text && REQUIRED_EXPERIENCE_FIELD.test(text) ? text : null)
}

const extractQualificationSnippet = (value) => {
  const text = stripTags(value)
  if (!text) return null
  return normalizeWhitespace(
    extractFirst(
      /([^.]*\b(?:bachelor|master|degree|b\.tech|b\.e\.|m\.tech|mba)\b[^.]*\.)/i,
      text,
    ),
  )
}

const normalizeQualificationRequirement = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\b(bachelor|master|degree|b\.tech|b\.e\.|m\.tech|mba)\b/i.test(normalized)
    ? normalized
    : null
}

const normalizeSkills = (value = []) => [...new Set(
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean),
)]

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractRequiredSkillsFromDescription = (value) => {
  const decoded = decodeHtmlEntities(value)
  const skillsSection = extractFirst(
    /Required Skills<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/i,
    decoded,
  )

  return [...new Set(extractListItems(skillsSection))]
}

const extractJobPostingJsonLd = (html) => {
  const postings = []
  for (const script of nativeElements(html).scripts) {
    if (script.type !== 'application/ld+json') continue
    const raw = normalizeWhitespace(script.body)
    if (!raw || !raw.includes('"JobPosting"')) continue
    const parsed = parseJson(raw)
    if (parsed?.['@type'] === 'JobPosting') {
      postings.push(parsed)
    }
  }

  const unique = new Map(postings.map(posting => [JSON.stringify(posting), posting]))
  if (unique.size > 1) throw incompleteSnapshot('conflicting native JobPosting models')
  return unique.values().next().value || null
}

const getPrimaryJobLocation = (jobPosting) => {
  const primaryLocation = Array.isArray(jobPosting?.jobLocation)
    ? jobPosting.jobLocation[0]
    : jobPosting?.jobLocation

  const address = primaryLocation?.address
  if (!address) return {}

  const location = [address.addressLocality, address.addressRegion, address.addressCountry]
    .filter(Boolean)
    .join(', ')

  return {
    location: normalizeWhitespace(location),
    city: normalizeWhitespace(address.addressLocality),
    country: normalizeWhitespace(address.addressCountry),
  }
}

export const extractPhAppDdo = (html) => extractNativeModel(html, 'ddo')

const slugifyTitle = (title) => normalizeWhitespace(title)
  ?.normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || null

export const createPhenomScraper = ({
  companyName,
  source,
  baseUrl,
  searchPath = '/global/en/search-results',
  jobPathPrefix,
  listingPredicate,
  scraperDir,
  targetCountry = 'India',
  defaultDetailEnrichmentBudgetMs = null,
  defaultDetailConcurrency = 1,
  nativeConcatenatedStateCountry = false,
  nativeBangaloreLocationAlias = false,
  nativeLocalitySuffixFormatting = false,
  nativeBoundUSStateCodeFormatting = false,
  nativeReviewedIndiaCityAliases = false,
  nativeCityDashCountryFormatting = false,
  nativeDeferredCountryScope = false,
  nativeCountryBeforePostalCode = false,
  nativeCountryBeforeZipCode = false,
  nativeCityCountryLiteral = false,
  nativeUnspecifiedState = false,
  nativeStatePostalCodeFormatting = false,
  nativeLocalizedCountryNames = [],
  nativeIsoAlpha3CountryCodes = false,
  nativeBoundModelTitlePreference = false,
  nativeReviewedTitleBindings = [],
  useJobSequenceForDetailUrl = false,
  numberedOfficeLocations = null,
}) => {
  const titleBindingFields = { source: 160, jobId: 160, reqId: 160, jobSeqNo: 160,
    listingTitle: 512, nativeTitle: 512, jsonLdTitle: 512, canonical: 2048,
    fixture: 512, observedAt: 40, nativeModelSha256: 64 }
  if (!Array.isArray(nativeReviewedTitleBindings) || nativeReviewedTitleBindings.length > 64) {
    throw new Error('Phenom reviewed title bindings require a bounded array')
  }
  const reviewedTitleBindings = nativeReviewedTitleBindings.map(value => {
    const binding = {}
    for (const [field, maximum] of Object.entries(titleBindingFields)) {
      if (typeof value?.[field] !== 'string' || !value[field].trim() || value[field].length > maximum) {
        throw new Error('Phenom reviewed title binding has an invalid ' + field)
      }
      binding[field] = value[field]
    }
    if (binding.source !== source || !/^[a-f\d]{64}$/.test(binding.nativeModelSha256)
      || !Number.isFinite(Date.parse(binding.observedAt))) throw new Error('Phenom reviewed title binding has invalid provenance')
    return binding
  })
  const reviewedTitlePolicyKey = nativeDetailReceiptKey('phenom-reviewed-title-policy-v1',
    nativeBoundModelTitlePreference === true, reviewedTitleBindings)
  const config = loadConfig(scraperDir)
  // An opt-in names only observed locale/region pairs. Intl supplies the name;
  // source configuration cannot invent a country alias or replace another one.
  if (!Array.isArray(nativeLocalizedCountryNames) || nativeLocalizedCountryNames.length > 8) {
    throw new Error('Phenom localized country names require at most eight locale/region pairs')
  }
  if (typeof nativeCountryBeforeZipCode !== 'boolean') {
    throw new Error('Phenom nativeCountryBeforeZipCode option must be a boolean')
  }
  if (typeof nativeIsoAlpha3CountryCodes !== 'boolean') {
    throw new Error('Phenom ISO alpha-3 country-code option must be a boolean')
  }
  if (typeof nativeStatePostalCodeFormatting !== 'boolean') throw new Error('Phenom nativeStatePostalCodeFormatting option must be a boolean')
  const countryNames = new Map(knownCountries)
  const alpha3CountryMappings = nativeIsoAlpha3CountryCodes
    ? [...isoAlpha3CountryRegions].map(([code, region]) => ({ code, region })) : []
  for (const { code, region } of alpha3CountryMappings) {
    const key = code.toLowerCase()
    if (countryNames.has(key) && countryNames.get(key) !== region) {
      throw new Error('Phenom ISO alpha-3 country code conflicts with a known country')
    }
    countryNames.set(key, region)
  }
  const localizedCountryNames = nativeLocalizedCountryNames.map(entry => {
    if (!entry || typeof entry.locale !== 'string' || entry.locale.length > 32
      || typeof entry.region !== 'string' || !/^[A-Z]{2}$/.test(entry.region)
      || knownCountries.get(entry.region.toLowerCase()) !== entry.region
      || Intl.DisplayNames.supportedLocalesOf([entry.locale]).length !== 1) {
      throw new Error('Phenom localized country name requires a supported locale and known region')
    }
    const locale = Intl.getCanonicalLocales(entry.locale)[0]
    const label = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }).of(entry.region)
    const key = label?.toLowerCase()
    if (!key || countryNames.has(key) && countryNames.get(key) !== entry.region) {
      throw new Error('Phenom localized country name is absent or ambiguous')
    }
    countryNames.set(key, entry.region)
    return { label, region: entry.region, locale }
  })

  const toAbsoluteUrl = (value) => {
    try {
      return new URL(value, baseUrl).toString()
    } catch {
      return null
    }
  }

  const extractCity = (location, fallback) => {
    const normalized = normalizeWhitespace(fallback || location)
    if (!normalized) return null
    return normalized.split(',')[0]?.trim() || null
  }

  const normalizeEmploymentType = (value) => {
    const candidate = Array.isArray(value) ? value[0] : value
    const normalized = normalizeWhitespace(candidate)
    if (!normalized) return null

    if (/intern/i.test(normalized)) return 'Internship'
    if (/temporary|contract/i.test(normalized)) return 'Contract'
    if (/part[\s-]?time/i.test(normalized)) return null
    if (/full[\s_-]?time|permanent/i.test(normalized)) return 'Full-time'
    return normalized
  }

  const countryParts = value => (normalizeWhitespace(value) || '').split(/\s*\/\s*/).filter(Boolean)
  const alpha3MappingsFor = (...countries) => {
    const tokens = countries.flatMap(countryParts)
    return alpha3CountryMappings.filter(entry => tokens.some(token => token.toLowerCase() === entry.code.toLowerCase()))
  }
  const countryMatchesTarget = value => {
    if (typeof value !== 'string') return false
    const targetCode = countryCode(targetCountry)
    return Boolean(targetCode && countryCode(value) === targetCode)
  }
  const countryIsUnknown = value => {
    if (typeof value !== 'string') return true
    const parts = countryParts(value)
    return !parts.length || parts.some(part => !countryNames.has(part.toLowerCase()))
      || !countryMatchesTarget(value) && parts.some(part => countryNames.get(part.toLowerCase()) === countryNames.get(targetCountry.toLowerCase()))
  }
  const locationParts = value => {
    const parts = (normalizeWhitespace(value) || '').split(',').map(part => part.trim().normalize('NFC').toLowerCase()).filter(Boolean)
    // A published country name can itself contain a comma (Korea, Republic of).
    // Join only an exact known country suffix; city and state remain separate.
    for (let start = 0; start < parts.length - 1; start++) {
      const country = parts.slice(start).join(', ')
      if (countryNames.has(country)) return [...parts.slice(0, start), country]
    }
    return parts
  }
  const countryCode = value => {
    if (typeof value !== 'string') return null
    const parts=countryParts(value).map(part=>countryNames.get(part.toLowerCase()))
      .map(code => code ? new Intl.Locale('und-' + code).region : null)
    return parts.length && parts.every(Boolean) && new Set(parts).size===1 ? parts[0] : null
  }
  const prefixAgrees = (parts,full) => parts.length <= full.length && parts.every((part,index)=>part===full[index])
  const isStateOnlyLocation = (record, label) => {
    if (!record || normalizeWhitespace(record.city)) return false
    const state = locationParts(record.state), full = locationParts(label)
    return state.length > 0 && Boolean(countryCode(full.at(-1)))
      && state.length === full.length - 1 && prefixAgrees(state, full.slice(0, -1))
  }
  const nativeOfficeCoordinates = office => {
    const lat = office?.latlong?.lat, lon = office?.latlong?.lon
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
    for (const [name, expected] of [['latitude', lat], ['longitude', lon]]) {
      if (office[name] == null) continue
      if (!['number', 'string'].includes(typeof office[name]) || String(office[name]).trim() === ''
        || Number(office[name]) !== expected) return null
    }
    return [lat, lon]
  }
  const resolveDetailLocation = (value, standardisedOffices = []) => {
    if (typeof value === 'string') return { consistent:true,target:countryMatchesTarget(value.split(',').at(-1)) }
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || [value.country,value.city,value.state,value.cityState,value.cityCountry,value.stateCountry,value.location,value.cityStateCountry]
        .some(field=>field!=null && typeof field!=='string')) return {consistent:false,target:false}
    // A source opting into zipCode cannot discard a conflicting supplied postalCode.
    if (nativeCountryBeforeZipCode && Object.hasOwn(value, 'zipCode') && Object.hasOwn(value, 'postalCode')
      && (typeof value.zipCode !== 'string' || typeof value.postalCode !== 'string'
        || value.zipCode.trim().normalize('NFC').toLowerCase() !== value.postalCode.trim().normalize('NFC').toLowerCase())) {
      return {consistent:false,target:false}
    }
    const country = normalizeWhitespace(value.country)
    const full = normalizeWhitespace(value.cityStateCountry || value.location)
    if (!full) return {consistent:Boolean(countryCode(country)),target:countryMatchesTarget(country)}
    const complete = locationParts(full)
    const fullCountry=countryCode(complete.at(-1))
    if (!fullCountry || country && countryCode(country)!==fullCountry) return {consistent:false,target:false}
    const fullPrefix=complete.slice(0,-1)
    const city = normalizeWhitespace(value.city)
    const state=normalizeWhitespace(value.state)
    const literalCityParts = locationParts(city)
    const literalCityState = locationParts(value.cityState), literalCityCountry = locationParts(value.cityCountry)
    // NTT sometimes supplies the literal city field as "Bengaluru, India".
    // Keep that value unchanged and bind both tokens to this exact office.
    // This is not support for arbitrary comma-separated city lists.
    const cityCountryLiteral = nativeCityCountryLiteral && country === 'India' && fullCountry === 'IN'
      && literalCityParts.length === 2 && !/[\\/;|&+•·，、]|\b(?:and|or)\b/i.test(literalCityParts[0]) && !countryCode(literalCityParts[0])
      && countryCode(literalCityParts[1]) === fullCountry
      && literalCityParts.every(part => countryParts(part).every(component => !countryCode(component) || countryCode(component) === fullCountry))
      && state && /^IN-[A-Z]{2}$/.test(state) && complete.length === literalCityParts.length + 2
      && prefixAgrees(literalCityParts, fullPrefix) && fullPrefix.at(-1) === state.toLowerCase()
      && literalCityState.length === fullPrefix.length && prefixAgrees(literalCityState, fullPrefix)
      && literalCityCountry.length === literalCityParts.length + 1 && countryCode(literalCityCountry.at(-1)) === fullCountry
      && prefixAgrees(literalCityCountry.slice(0, -1), literalCityParts)
      && normalizeWhitespace(value.stateCountry)
      && locationParts(value.location).length === complete.length && prefixAgrees(locationParts(value.location), complete)
    if (city && !/^not location specific$/i.test(city) && city.normalize('NFC').toLowerCase() !== complete[0]
      && !cityCountryLiteral) return {consistent:false,target:false}
    const region = isStateOnlyLocation(value, full) ? fullPrefix : complete.slice(cityCountryLiteral ? literalCityParts.length : 1,-1)
    // Orange's current native country/city-only offices use this exact marker
    // for an absent state. Accept it only with mutually consistent explicit
    // India, city and country-only stateCountry fields; real regions still bind.
    const unspecifiedState = nativeUnspecifiedState && ['UN SPECIFIED', 'State not Applicable'].includes(state)
      && countryCode(country) === 'IN' && fullCountry === 'IN' && region.length === 0
      && fullPrefix.length === 1 && city?.normalize('NFC').toLowerCase() === fullPrefix[0]
      && locationParts(value.cityState).length === 1 && prefixAgrees(locationParts(value.cityState), fullPrefix)
      && locationParts(value.stateCountry).length === 1 && countryCode(value.stateCountry) === 'IN'
    if (state && !/^not location specific$/i.test(state) && !unspecifiedState && !prefixAgrees(locationParts(state),region)) return {consistent:false,target:false}
    if (normalizeWhitespace(value.cityState) && !prefixAgrees(locationParts(value.cityState),fullPrefix)) return {consistent:false,target:false}
    for(const [fieldName,expected] of [['cityCountry',fullPrefix],['stateCountry',region]]) {
      const field = value[fieldName]
      if (!normalizeWhitespace(field)) continue
      // NTT's current numeric-role feed serializes this redundant field as
      // "IndiaIN-TN, ". The adapter opts into that exact native format only;
      // explicit country, city, ISO state and the full office label above
      // still have to agree, as do the other supplied office/schema fields.
      const concatenatedIndiaState = nativeConcatenatedStateCountry && fieldName === 'stateCountry'
        && country === 'India' && fullCountry === 'IN' && city && /^IN-[A-Z]{2}$/.test(state || '')
        && region.length === 1 && region[0] === state.toLowerCase()
        && normalizeWhitespace(value.cityState) && normalizeWhitespace(value.cityCountry)
        && normalizeWhitespace(field) === country + state + ','
      if (concatenatedIndiaState) continue
      const parts=locationParts(field)
      if (countryCode(parts.at(-1))!==fullCountry || !prefixAgrees(parts.slice(0,-1),expected)) return {consistent:false,target:false}
    }
    const short = locationParts(value.location)
    if (!short.length) return {consistent:true,target:fullCountry===countryCode(targetCountry)}
    const shortCountry = countryCode(short.at(-1))
    if (shortCountry && shortCountry!==fullCountry) return {consistent:false,target:false}
    // Quest's Dubai display is "Dubai - United Arab Emirates". The display
    // supplies no geography: the same office's typed city/state/country and
    // redundant full labels above must already agree exactly.
    const cityDashCountry = nativeCityDashCountryFormatting && city && state
      && countryCode(country) === fullCountry && fullPrefix.length === 2
      && fullPrefix[0] === city.normalize('NFC').toLowerCase()
      && fullPrefix[1] === state.normalize('NFC').toLowerCase()
      && normalizeWhitespace(value.location) === city + ' - ' + country
    if (cityDashCountry) return {consistent:true,target:fullCountry===countryCode(targetCountry)}
    // A postal suffix (including a native N/A marker) supplies no country.
    // Bind the exact label to this office's explicit country and full region.
    const postalCode = typeof value.postalCode === 'string' ? value.postalCode.trim().normalize('NFC').toLowerCase() : null
    const zipCode = nativeCountryBeforeZipCode && Object.hasOwn(value, 'zipCode') && typeof value.zipCode === 'string'
      ? value.zipCode.trim().normalize('NFC').toLowerCase() : null
    const countryBeforePostalValue = postalValue => city && state && countryCode(country) === fullCountry
      // Redundant display fields cannot add another region or country between
      // this office's typed city/state and its country/postal suffix.
      && fullPrefix.length === 2 && fullPrefix[0] === city.normalize('NFC').toLowerCase()
      && fullPrefix[1] === state.normalize('NFC').toLowerCase()
      && postalValue && postalValue.length <= 32 && short.at(-1) === postalValue
      && short.length === fullPrefix.length + 2 && countryCode(short.at(-2)) === fullCountry
      && prefixAgrees(short.slice(0, -2), fullPrefix)
      && ['cityStateZipCode', 'cityStatePostalCode'].every(field => {
        if (!Object.hasOwn(value, field)) return true
        if (typeof value[field] !== 'string' || !value[field].trim()) return false
        const alias = locationParts(value[field])
        return alias.at(-1) === postalValue && (alias.length === fullPrefix.length + 1
          && prefixAgrees(alias.slice(0, -1), fullPrefix)
          || alias.length === fullPrefix.length + 2 && countryCode(alias.at(-2)) === fullCountry
            && prefixAgrees(alias.slice(0, -2), fullPrefix))
      })
    const statePostalLabel = nativeStatePostalCodeFormatting && fullCountry === 'IN' && shortCountry === 'IN'
      && countryCode(country) === 'IN' && city && state && /^[1-9]\d{5}$/.test(postalCode || '')
      && fullPrefix.length === 2 && short.length >= 3 && short.at(-3) === fullPrefix[0]
      && short.at(-2) === fullPrefix[1] + ' ' + postalCode
      && (short.length === 3 || nativeLocalitySuffixFormatting && short.slice(0, -3).every(part =>
        countryParts(part).every(country => !countryCode(country) || countryCode(country) === fullCountry)))
      && (!Object.hasOwn(value, 'zipCode') || typeof value.zipCode === 'string' && value.zipCode.trim() === postalCode)
      && ['cityStateZipCode', 'cityStatePostalCode'].every(field => !Object.hasOwn(value, field)
        || typeof value[field] === 'string' && normalizeWhitespace(value[field]) === city + ', ' + state + ' ' + postalCode)
    if (statePostalLabel) return { consistent: true, target: true, nativeStatePostalCode: true }
    const countryBeforePostalCode = nativeCountryBeforePostalCode && countryBeforePostalValue(postalCode)
    const countryBeforeZipCode = nativeCountryBeforeZipCode && countryBeforePostalValue(zipCode)
    const postalLabel = !shortCountry && countryCode(country) === fullCountry
      && postalCode && postalCode.length <= 32 && short.at(-1) === postalCode
      && short.length - 1 === fullPrefix.length && prefixAgrees(short.slice(0, -1), fullPrefix)
      && (value.cityStateZipCode == null || typeof value.cityStateZipCode === 'string'
        && normalizeWhitespace(value.cityStateZipCode) === normalizeWhitespace(value.location))
    // Native named offices may have no city. A name or identifier alone cannot
    // supply geography: both must bind to this office's explicit country and
    // consistent full region above.
    const namedOffice = !shortCountry && countryCode(country) === fullCountry && fullPrefix.length > 0
      && normalizeWhitespace(value.cityStateCountry) && (normalizeWhitespace(value.state) || city)
      && typeof value.locationName === 'string' && typeof value.locationId === 'string' && value.locationId.trim()
      && normalizeWhitespace(value.locationName) === normalizeWhitespace(value.location)
    // Lowe's names a numbered office as "Bengaluru 1499" while its location ID
    // and name are "LWS1499" and "LWS_IND_Bengaluru 1499". The source opts in
    // with exact prefixes; city, country and all other office fields above must
    // still agree. A bare number or an unverified office label cannot add scope.
    const numbered = normalizeWhitespace(value.location)?.match(/^(.+) (\d{3,8})$/)
    const numberedOffice = numberedOfficeLocations && !shortCountry && city
      && countryCode(country) === fullCountry && fullPrefix.length > 0
      && numbered && (numbered[1] === city || Array.isArray(numberedOfficeLocations.buildingLabels)
        && numberedOfficeLocations.buildingLabels.includes(numbered[1]))
      && typeof numberedOfficeLocations.idPrefix === 'string' && numberedOfficeLocations.idPrefix
      && typeof numberedOfficeLocations.namePrefix === 'string' && numberedOfficeLocations.namePrefix
      && value.locationId === numberedOfficeLocations.idPrefix + numbered[2]
      && value.locationName === numberedOfficeLocations.namePrefix + numbered[0]
    if (countryBeforeZipCode) return {consistent:true,target:fullCountry===countryCode(targetCountry),nativeZipCode:true}
    if (postalLabel || countryBeforePostalCode || namedOffice || numberedOffice) return { consistent: true, target: fullCountry === countryCode(targetCountry) }
    const shortPrefix = shortCountry ? short.slice(0,-1) : short
    // An abbreviated native label is usable only alongside the same office's
    // explicit country and full label, with every short component equal.
    if (!shortCountry && (!countryCode(country) || !value.cityStateCountry)) return {consistent:false,target:false}
    // Quest advertises Bangalore while its native office record spells the
    // same city Bengaluru. Accept only that captured Karnataka/India label,
    // with every other supplied office component already corroborated above.
    const nativeBangaloreAlias = nativeBangaloreLocationAlias && countryCode(country) === 'IN'
      && fullCountry === 'IN' && shortCountry === 'IN' && city?.normalize('NFC').toLowerCase() === 'bengaluru'
      && fullPrefix.length === 2 && fullPrefix[0] === 'bengaluru' && fullPrefix[1] === 'karnataka'
      && shortPrefix.length === 2 && shortPrefix[0] === 'bangalore' && shortPrefix[1] === fullPrefix[1]
      && normalizeWhitespace(value.cityState) && normalizeWhitespace(value.cityCountry)
    const reviewedIndiaCityAlias = nativeReviewedIndiaCityAliases && countryCode(country) === 'IN'
      && fullCountry === 'IN' && shortCountry === 'IN' && city && state
      && fullPrefix.length === 2 && shortPrefix.length === 2 && shortPrefix[1] === fullPrefix[1]
      && state.normalize('NFC').toLowerCase() === fullPrefix[1]
      && normalizeWhitespace(value.cityState) && normalizeWhitespace(value.cityCountry)
      && REVIEWED_INDIA_CITY_NAMES.some(group => group.states.includes(fullPrefix[1])
        && group.names.includes(fullPrefix[0]) && group.names.includes(shortPrefix[0]))
    // A longer native label may include a locality before the already bound
    // city/state/country, or before state/country when the native city is absent.
    // Preserve that prefix as text; it never fills an absent canonical city.
    const localityPrefix = shortPrefix.slice(0, shortPrefix.length - fullPrefix.length)
    const localitySuffix = nativeLocalitySuffixFormatting && countryCode(country) === fullCountry
      && shortCountry === fullCountry && fullPrefix.length > 0 && shortPrefix.length > fullPrefix.length
      && fullPrefix.every((part, index) => shortPrefix[localityPrefix.length + index] === part)
      && localityPrefix.every(part => countryParts(part).every(country => !countryCode(country) || countryCode(country) === fullCountry))
    // A US state code is usable only through one same-job standardized office.
    // Coordinates join the two explicit offices; they supply no geography.
    let boundUSStateCode = false
    if (nativeBoundUSStateCodeFormatting && fullCountry === 'US' && countryCode(country) === 'US'
      && shortCountry === 'US' && city && state && fullPrefix.length === 2 && shortPrefix.length === 2
      && shortPrefix[0] === fullPrefix[0] && /^[a-z]{2}$/.test(shortPrefix[1])
      && Array.isArray(standardisedOffices)) {
      const coordinates = nativeOfficeCoordinates(value)
      const matches = coordinates ? standardisedOffices.filter(office => {
        if (!office || typeof office !== 'object' || Array.isArray(office)
          || office.isLocationStandardized !== true || countryCode(office.standardisedCountry) !== 'US'
          || typeof office.standardisedCity !== 'string' || typeof office.standardisedState !== 'string'
          || normalizeWhitespace(office.standardisedCity)?.toLowerCase() !== city.toLowerCase()
          || normalizeWhitespace(office.standardisedState)?.toLowerCase() !== state.toLowerCase()) return false
        const canonical = locationParts(office.standardisedMapQueryLocation)
        const candidateCoordinates = nativeOfficeCoordinates(office)
        return canonical.length === fullPrefix.length + 1 && countryCode(canonical.at(-1)) === 'US'
          && prefixAgrees(canonical.slice(0, -1), fullPrefix) && candidateCoordinates
          && candidateCoordinates.every((coordinate, index) => coordinate === coordinates[index])
      }) : []
      boundUSStateCode = matches.length === 1 && typeof matches[0].standardisedStateCode === 'string'
        && matches[0].standardisedStateCode.trim().toLowerCase() === shortPrefix[1]
    }
    const consistent=prefixAgrees(shortPrefix,fullPrefix) || Boolean(nativeBangaloreAlias || reviewedIndiaCityAlias || localitySuffix || boundUSStateCode)
    return {consistent,target:consistent && fullCountry===countryCode(targetCountry)}
  }
  const detailLocationHasTarget = (value, standardisedOffices) => resolveDetailLocation(value, standardisedOffices).target
  const resolveListingScope = raw => {
    const locations = [...new Set([
      ...(Array.isArray(raw.multi_location) ? raw.multi_location : []),
      ...(Array.isArray(raw.multi_location_array) ? raw.multi_location_array.map(item => item?.location) : []),
    ].filter(value => typeof value === 'string').map(normalizeWhitespace).filter(Boolean))]
    const targetLocations = locations.filter(location => countryMatchesTarget(location.split(',').at(-1)))
    const target = countryMatchesTarget(raw.country) || targetLocations.length > 0
    const primary = normalizeWhitespace(raw.cityStateCountry || raw.location || raw.cityState)
    const location = targetLocations[0] || primary || (target ? targetCountry : null)
    return { target, unknown: countryIsUnknown(raw.country), location, locations }
  }
  const getTargetCountryCount = aggregationValue => {
    if (!aggregationValue || typeof aggregationValue !== 'object') return null
    const matches = Object.entries(aggregationValue).filter(([country]) => countryMatchesTarget(country))
    return matches.length && matches.every(([, count]) => Number.isInteger(count) && count >= 0)
      ? matches.reduce((sum, [, count]) => sum + count, 0) : null
  }

  const resolveJobPathPrefix = () => {
    if (jobPathPrefix) return jobPathPrefix

    const matchedPrefix = String(searchPath).match(/^\/(?:[a-z]{2}|global)\/[a-z]{2}(?=\/|$)/i)
    if (matchedPrefix) return matchedPrefix[0]

    return '/global/en'
  }

  const buildSearchResultsPageUrl = (from = 0) => {
    const url = new URL(searchPath, baseUrl)
    if (Number.isInteger(from) && from > 0) {
      url.searchParams.set('from', String(from))
    }
    return url.toString()
  }

  const buildJobDetailUrl = (listing = {}) => {
    const sequence = useJobSequenceForDetailUrl ? normalizeWhitespace(listing.jobSeqNo) : null
    if (sequence && !/^[A-Za-z0-9_-]{1,160}$/.test(sequence)) throw incompleteSnapshot('invalid native detail URL sequence')
    return toAbsoluteUrl(`${resolveJobPathPrefix()}/job/${sequence || listing.reqId || listing.jobId}/${slugifyTitle(listing.title)}`)
  }

  const extractSearchPayload = (html) => {
    const ddo = extractPhAppDdo(html)
    const payload = ddo?.eagerLoadRefineSearch || ddo?.targetedJobs || {}
    if (payload.status != null && payload.status !== 200 || payload.error || payload.success === false) {
      throw incompleteSnapshot('native listing reported a failure')
    }
    if (!Array.isArray(payload.data?.jobs) && !Array.isArray(payload.jobs)) throw incompleteSnapshot('unrecognized jobs payload')
    const jobs = Array.isArray(payload.data?.jobs)
      ? payload.data.jobs
      : (Array.isArray(payload.jobs) ? payload.jobs : [])

    return {
      widgetApiEndpoint: normalizeWhitespace(
        ddo?.siteConfig?.data?.refineSearchAPIUrl
          || ddo?.siteConfig?.data?.widgetApiEndpoint
          || extractFirst(/"widgetApiEndpoint":"([^"]+)"/i, html),
      ),
      totalHits: Number.isInteger(payload.totalHits) ? payload.totalHits : null,
      hits: Number.isInteger(payload.hits) ? payload.hits : null,
      jobs,
      aggregations: normalizeAggregationMap(payload.data?.aggregations || payload.aggregations),
    }
  }

  const extractSearchResults = (payload = {}) => (payload.jobs || [])
    .filter((job) => (typeof listingPredicate === 'function' ? listingPredicate(job) : true))
    .map((job) => {
      const sourceUrl = buildJobDetailUrl(job)
      const location = normalizeWhitespace(job.cityStateCountry || job.location || job.cityState)
      const description = normalizeWhitespace(
        job.ml_highlight || job.descriptionTeaser || job.ml_job_parser?.descriptionTeaser || null,
      )
      const sourceEmploymentType = normalizeEmploymentType(job.type)
      const sourceExperienceRequired = nativeExperienceRequirement(job.experience)

      if (!job?.reqId || !job?.title || !sourceUrl) return null

      return {
        title: normalizeWhitespace(job.title),
        location,
        city: isStateOnlyLocation(job, location) ? null : extractCity(location, job.city),
        country: normalizeWhitespace(job.country),
        jobId: normalizeWhitespace(job.jobId || job.reqId),
        requisitionId: normalizeWhitespace(job.reqId || job.jobId),
        department: normalizeWhitespace(job.category),
        employmentType: sourceEmploymentType,
        sourceEmploymentType,
        experienceRequired: extractExperienceSnippet(job.experience, { requireKeyword: false, allowLabels: true }),
        sourceExperienceRequired,
        jobDescription: description,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: normalizeSkills(job.ml_skills),
        postingDate: normalizeWhitespace(job.postedDate || job.dateCreated),
        applyUrl: normalizeWhitespace(job.applyUrl),
        sourceUrl,
      }
    })
    .filter(Boolean)

  const extractStructuredJobDetail = (html) => {
    const ddo = extractPhAppDdo(html)
    const payload = ddo?.jobDetail
    if (payload?.status != null && payload.status !== 200 || payload?.error || payload?.success === false) {
      throw incompleteSnapshot('native detail reported a failure')
    }
    return ddo?.jobDetail?.data?.job || null
  }

  const extractJobDetail = (html, listing = {}, preferNativeModel = false) => {
    const structuredJob = extractStructuredJobDetail(html)
    const jobPosting = preferNativeModel ? null : extractJobPostingJsonLd(html)
    const primaryLocation = getPrimaryJobLocation(jobPosting)
    const rawDescription = [structuredJob?.ml_Description, jobPosting?.description]
      .find(value => typeof value === 'string' && hasSourceDescription({ jobDescription: value })) || null
    const richDescription = typeof jobPosting?.description === 'string' ? jobPosting.description : null
    const sourceUrl = listing.sourceUrl
      || normalizeWhitespace(
        extractCanonical(html),
      )
      || normalizeWhitespace(jobPosting?.hiringOrganization?.url)

    const description = stripTags(rawDescription)
    const requiredSkills = extractRequiredSkillsFromDescription(richDescription)
    const explicitExperienceSentence = structuredJob?.experience_sentences?.[0]
    const explicitExperienceLabel = normalizeExperienceLabel(explicitExperienceSentence)
    const experienceRequired = explicitExperienceLabel === 'No experience required'
      ? explicitExperienceLabel
      : (
          extractExperienceSnippet(explicitExperienceSentence, {
            requireKeyword: false,
          })
          || extractExperienceSnippet(structuredJob?.experience, {
            requireKeyword: false,
          })
          || extractExperienceSnippet(description)
          || explicitExperienceLabel
          || normalizeExperienceLabel(structuredJob?.experience)
        )
    const sourceExperienceRequired = nativeExperienceRequirement(structuredJob?.experience)
    const sourceEmploymentType = normalizeEmploymentType(structuredJob?.job_type_fields?.job_type
      || structuredJob?.employmentType || structuredJob?.type || jobPosting?.employmentType)

    return {
      title: normalizeWhitespace(
        jobPosting?.title || structuredJob?.title || listing.title,
      ),
      location: normalizeWhitespace(
        listing.location || structuredJob?.location || primaryLocation.location,
      ),
      city: isStateOnlyLocation(structuredJob, listing.location || structuredJob?.cityStateCountry) ? null : normalizeWhitespace(
        listing.city || structuredJob?.city || primaryLocation.city || extractCity(listing.location),
      ),
      country: normalizeWhitespace(
        listing.country || structuredJob?.ml_country || structuredJob?.standardisedCountry || primaryLocation.country,
      ),
      jobId: normalizeWhitespace(
        structuredJob?.jobId || listing.jobId,
      ),
      requisitionId: normalizeWhitespace(
        structuredJob?.reqId || structuredJob?.jobId || listing.requisitionId || listing.jobId,
      ),
      department: normalizeWhitespace(
        listing.department || structuredJob?.category || jobPosting?.occupationalCategory,
      ),
      employmentType: sourceEmploymentType,
      sourceEmploymentType,
      experienceRequired,
      sourceExperienceRequired,
      jobDescription: description,
      minimumQualification: normalizeQualificationRequirement(
        structuredJob?.education_sentences?.[0],
      ) || extractQualificationSnippet(description),
      preferredQualification: null,
      requiredSkills: normalizeSkills(
        requiredSkills.length
          ? requiredSkills
          : (structuredJob?.skills_sentences?.length
              ? structuredJob.skills_sentences
              : structuredJob?.ml_skills)
      ),
      postingDate: normalizeWhitespace(
        jobPosting?.datePosted || structuredJob?.postedDate || listing.postingDate,
      ),
      applyUrl: normalizeWhitespace(structuredJob?.applyUrl || listing.applyUrl || sourceUrl),
      sourceUrl,
      publicExperienceChecked: Boolean(sourceUrl && (structuredJob || jobPosting || description)),
    }
  }

  const fetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: config.retryAttempts || 1,
    baseDelayMs: config.retryBaseDelayMs || 1000,
    label: source,
    signal,
    timeoutMs: config.fetchTimeoutMs || DEFAULT_FETCH_TIMEOUT_MS,
  })

  const resolveWidgetRequest = html => {
    const searchUrl = new URL(searchPath, baseUrl)
    // Preserve supported keyword scope; arbitrary filters still use their original HTML route.
    if ([...searchUrl.searchParams.keys()].some(key => key !== 'keywords' && key !== 's')
      || searchUrl.searchParams.getAll('keywords').length > 1
      || searchUrl.searchParams.has('s') && (searchUrl.searchParams.getAll('s').length !== 1 || searchUrl.searchParams.get('s') !== '1')
      || searchUrl.hash || !searchUrl.pathname.endsWith('/search-results')) return null
    const app = extractNativeModel(html, 'app')
    if (!app?.widgetApiEndpoint || !app.locale || !app.deviceType || !app.country || app.pageName !== 'search-results') return null
    try {
      const url = new URL(app.widgetApiEndpoint)
      if (url.origin !== new URL(baseUrl).origin || url.pathname !== '/widgets' || url.search || url.hash) return null
      const countryAggregation = extractSearchPayload(html).aggregations.country || {}
      const countries = Object.keys(countryAggregation).filter(countryMatchesTarget)
      // Fetch a bounded country inventory in one page when possible to avoid overlaps at date-sort ties.
      const pageSize = Math.min(500, Math.max(100, getTargetCountryCount(countryAggregation) ?? 0))
      const sortField = normalizeWhitespace(extractPhAppDdo(html)?.siteConfig?.data?.refineSearch?.sort?.field) || 'postedDate'
      return { url: url.toString(), body: { lang: app.locale, deviceType: app.deviceType, country: app.country,
        pageName: app.pageName, ddoKey: 'refineSearch', jobs: true, counts: true, all_fields: ['country'], size: pageSize,
        global: true, keywords: searchUrl.searchParams.get('keywords') || '', sortBy: 'Most recent', sort: { field: sortField, order: 'desc' },
        ...(countries.length ? { selected_fields: { country: countries } } : {}),
      } }

    } catch { return null }
  }
  const fetchWidgetJson = (url, options = {}) => fetchJsonWithRetry(url, {
    ...options,
    attempts: config.retryAttempts || 1,
    baseDelayMs: config.retryBaseDelayMs || 1000,
    label: source + ' Phenom listings',
    timeoutMs: config.fetchTimeoutMs || DEFAULT_FETCH_TIMEOUT_MS,
  })

  const run = async (options = {}) => {
    const getPage = options.fetchText || fetchText
    const signal = options.signal
    const recovery = options.nativeDetailRecovery ?? currentNativeDetailRecovery()
    signal?.throwIfAborted()
    // The central maxPages setting belongs to DOM scrapers, not this API-backed inventory.
    const maxPages = Number.isInteger(options.maxPages) ? Math.max(0, options.maxPages)
      : Number.isInteger(config.phenomMaxPages) ? Math.max(0, config.phenomMaxPages) : Infinity
    const maxJobs = Number.isInteger(options.maxJobs) ? Math.max(0, options.maxJobs) : Infinity
    const listingBudgetMs = nonnegativeBudget(options.listingBudgetMs ?? process.env.PHENOM_LISTING_BUDGET_MS, DEFAULT_LISTING_BUDGET_MS)
    const detailConcurrency = Math.min(8, Math.max(1, Math.floor(Number(options.detailConcurrency ?? defaultDetailConcurrency)) || 1))
    if (maxPages === 0 || maxJobs === 0) throw incompleteSnapshot('nonpositive listing limit cannot establish an empty inventory')
    const seenRawIds = new Set()
    const targetListings = []
    const nativeListingSequences = new WeakMap()
    const nativeListingCountries = new WeakMap()
    const nativeListingsWithoutApply = new WeakSet()
    const nativeDeferredOffices = new WeakMap()
    let offset = Number.isInteger(options.initialFrom) ? Math.max(0, options.initialFrom) : 0
    let totalHits = null
    let targetCountryCount = null
    let complete = false
    let uncertainScope = offset > 0
    let budgetExpired = false
    let widgetRequest = null
    let pagesFetched = 0
    const useWidgetApi = options.useWidgetApi ?? Boolean(options.fetchJson || !options.fetchText)
    const listingController = new AbortController()
    const listingSignal = signal ? AbortSignal.any([signal, listingController.signal]) : listingController.signal
    const listingTimer = setTimeout(() => {
      budgetExpired = true
      listingController.abort(incompleteSnapshot('listing budget expired'))
    }, listingBudgetMs)
    try {
      for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
        let payload
        let pageHtml
        if (!widgetRequest) {
          pageHtml = await requestWithSignal(getPage, buildSearchResultsPageUrl(offset), listingSignal)
          if (pageNumber === 0 && useWidgetApi) widgetRequest = resolveWidgetRequest(pageHtml)
        }
        if (widgetRequest) {
          const response = await requestWithSignal(options.fetchJson || fetchWidgetJson, widgetRequest.url, listingSignal, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ ...widgetRequest.body, from: offset }),
          })
          const data = response?.refineSearch
          if (data?.status !== 200 || !Array.isArray(data?.data?.jobs)) throw incompleteSnapshot('invalid widget listing payload')
          payload = { jobs: data.data.jobs, totalHits: data.totalHits, hits: data.hits, aggregations: normalizeAggregationMap(data.data.aggregations) }
        } else {
          payload = extractSearchPayload(pageHtml)
        }
        if (!Number.isInteger(payload.totalHits) || payload.totalHits < 0) throw incompleteSnapshot('unrecognized listing payload or total')
        pagesFetched += 1
        if (totalHits != null && totalHits !== payload.totalHits) uncertainScope = true
        totalHits = Math.max(totalHits ?? 0, payload.totalHits)
        const count = getTargetCountryCount(payload.aggregations?.country)
        if (count != null) {
          if (targetCountryCount != null && targetCountryCount !== count) uncertainScope = true
          targetCountryCount = Math.max(targetCountryCount ?? 0, count)
        }
        const rawJobs = payload.jobs
        if (!rawJobs.length) {
          if (totalHits === 0 && !seenRawIds.size && !(targetCountryCount > 0)) { complete = true; break }
          throw incompleteSnapshot('empty page at offset ' + offset + ' after ' + seenRawIds.size + ' unique records of ' + totalHits)
        }
        let added = 0
        for (const raw of rawJobs) {
          const nativeSequence = typeof raw?.jobSeqNo === 'string' ? normalizeWhitespace(raw.jobSeqNo) : null
          if (raw?.jobSeqNo != null && !nativeSequence) throw incompleteSnapshot('malformed native listing sequence')
          const rawId = normalizeWhitespace(raw?.jobSeqNo || raw?.jobId || raw?.reqId)
          if (!rawId || !normalizeWhitespace(raw?.reqId) || !normalizeWhitespace(raw?.title)) throw incompleteSnapshot('malformed listing identity')
          if (seenRawIds.has(rawId)) continue
          seenRawIds.add(rawId)
          added += 1
          const scope = resolveListingScope(raw)
          if (scope.unknown) uncertainScope = true
          // HPE's country-filtered search can return a foreign primary with
          // postal-only secondary labels. The facet and coordinates cannot
          // certify India. Keep a bounded, explicitly requested candidate for
          // the existing detail workers; it is never returned until its own
          // typed native India office and all identity checks qualify it.
          const deferredScope = nativeDeferredCountryScope && !scope.target && !scope.unknown
            && widgetRequest?.body.selected_fields?.country?.length === 1
            && countryMatchesTarget(widgetRequest.body.selected_fields.country[0])
            && countryCode(locationParts(raw.cityStateCountry).at(-1)) === countryCode(raw.country)
            && raw.isMultiLocation === true && Array.isArray(raw.multi_location_array)
            && raw.multi_location_array.length > 1 && raw.multi_location_array.length <= 50
            && raw.multi_location_array.every(office => office && typeof office === 'object' && !Array.isArray(office)
              // This recovery covers the captured postal-label/coordinates
              // shape only. Never ignore newly supplied geography fields.
              && Object.keys(office).every(key => key === 'location' || key === 'latlong')
              && typeof office.location === 'string' && normalizeWhitespace(office.location) && nativeOfficeCoordinates(office))
            && raw.multi_location_array.some(office => !countryCode(locationParts(office.location).at(-1)))
          if (!scope.target && !deferredScope) continue
          const scopedRaw = deferredScope ? raw : { ...raw, country: targetCountry, cityStateCountry: scope.location,
            city: isStateOnlyLocation(raw, scope.location) ? null : scope.location ? extractCity(scope.location) : raw.city }
          if (typeof listingPredicate === 'function' && !listingPredicate(scopedRaw)) continue
          const [listing] = extractSearchResults({ jobs: [scopedRaw] })
          if (!listing) throw incompleteSnapshot('unparsed target-country listing')
          const verifiedListing = { ...listing, country: deferredScope ? normalizeWhitespace(raw.country) : targetCountry,
            ...(scope.locations.length > 1 ? { locations: scope.locations } : {}) }
          nativeListingSequences.set(verifiedListing, nativeSequence)
          nativeListingCountries.set(verifiedListing,raw.country)
          if (!Object.hasOwn(raw, 'applyUrl')) nativeListingsWithoutApply.add(verifiedListing)
          if (deferredScope) nativeDeferredOffices.set(verifiedListing, structuredClone(raw.multi_location_array))
          targetListings.push(verifiedListing)
        }
        if (!added) throw incompleteSnapshot('duplicate page before inventory completion')
        if (seenRawIds.size > totalHits) throw incompleteSnapshot('reported total is smaller than the unique listing inventory')
        offset += rawJobs.length
        if (seenRawIds.size === totalHits) {
          complete = true
          if (typeof listingPredicate !== 'function' && targetCountryCount != null && targetListings.length < targetCountryCount) uncertainScope = true
          break
        }
        // An overlapping final page can exhaust the advertised offsets without
        // yielding every unique ID. Keep verified jobs, but mark the inventory
        // incomplete so persistence preserves roles absent from this snapshot.
        if (offset >= totalHits) break
        if (targetListings.length >= maxJobs) break
      }
    } catch (error) {
      signal?.throwIfAborted()
      if (!budgetExpired || !targetListings.length) throw error
    } finally {
      clearTimeout(listingTimer)
    }
    signal?.throwIfAborted()
    const selected = targetListings.slice(0, maxJobs)
    const incomplete = !complete || uncertainScope || selected.length < targetListings.length
    if (incomplete && !selected.length) throw incompleteSnapshot('no verified target jobs before listing completion')
    if (incomplete) console.warn('[' + source + '] Incomplete Phenom listing; preserving previous vacancies (' + selected.length + ' verified target jobs).')
    const jobs = selected.map(listing => ({
      ...listing, company: companyName, source, link: listing.applyUrl || listing.sourceUrl,
      sourceListingTeaser: listing.jobDescription,
      ...(nativeIsoAlpha3CountryCodes && alpha3MappingsFor(nativeListingCountries.get(listing)).length ? {
        sourceNativeCountryEvidence: {
          listingCountry: nativeListingCountries.get(listing),
          nativeCountryCodeMappings: alpha3MappingsFor(nativeListingCountries.get(listing)).map(entry => ({ ...entry })),
        },
      } : {}),
      jobDescription: null,
      applyUrl: listing.applyUrl || listing.sourceUrl, publicExperienceChecked: listing.publicExperienceChecked === true,
      sourceDetailComplete: false, sourceDetailFailureKind: 'budget-exhausted',
      ...(incomplete ? { sourceListingComplete: false } : {}), scrapedAt: new Date().toISOString(),
    }))
    attachInventoryEvidence(jobs, {
      status: incomplete ? 'discovery-only' : totalHits === 0 ? 'verified-empty' : 'complete-inventory',
      firstParty: true, listingComplete: !incomplete, surface: buildSearchResultsPageUrl(0),
      pagesFetched, reportedTotal: totalHits,
      indiaFacetCount: targetCountryCount ?? (incomplete ? null : targetListings.length),
      verifiedAt: new Date().toISOString(), reason: incomplete ? 'phenom-native-listing-incomplete-or-scope-uncertain'
        : 'phenom-native-total-unique-identities-and-target-scope-reconciled-detail-health-separate',
    })
    const finalizeJobs = () => {
      const qualified = jobs.filter((job, index) => !nativeDeferredOffices.has(selected[index])
        || job.sourceDetailComplete === true && job.country === targetCountry)
      const finalIncomplete = incomplete || qualified.length < jobs.length
      if (finalIncomplete && !qualified.length) throw incompleteSnapshot('no verified target jobs before listing completion')
      for (const job of qualified) {
        if (finalIncomplete) job.sourceListingComplete = false
        else delete job.sourceListingComplete
      }
      return attachInventoryEvidence(qualified, {
        ...readInventoryEvidence(jobs), listingComplete: !finalIncomplete,
        status: finalIncomplete ? 'discovery-only' : totalHits === 0 ? 'verified-empty' : 'complete-inventory',
        reason: finalIncomplete ? 'phenom-native-listing-incomplete-or-scope-uncertain'
          : 'phenom-native-total-unique-identities-and-target-scope-reconciled-detail-health-separate',
      })
    }
    // Every verified listing still needs its full native detail. Allow one
    // second per worker wave beyond the base allowance, bounded independently
    // of inventory size. Explicit source, environment and option budgets keep
    // their exact limits, including zero and values above the implicit cap.
    const requestedDetailBudgetMs = nonnegativeBudget(
      options.detailEnrichmentBudgetMs ?? process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS,
      defaultDetailEnrichmentBudgetMs ?? Math.min(
        MAX_DEFAULT_DETAIL_BUDGET_MS,
        DEFAULT_DETAIL_BUDGET_MS + Math.ceil(jobs.length / detailConcurrency) * DEFAULT_DETAIL_WORKER_WAVE_ALLOWANCE_MS,
      ),
    )
    const detailBudgetMs = nativeDetailPassBudget(recovery, requestedDetailBudgetMs)
    if (!jobs.length || detailBudgetMs === 0) {
      if (recovery && requestedDetailBudgetMs > 0) recovery.pending += jobs.length
      return finalizeJobs()
    }
    const detailController = new AbortController()
    const detailSignal = signal ? AbortSignal.any([signal, detailController.signal]) : detailController.signal
    const detailTimer = setTimeout(() => detailController.abort(new Error('Phenom optional detail budget expired')), detailBudgetMs)
    try {
      let nextDetail = 0
      // Settle unresolved scope before spending the same finite detail budget
      // on rows whose India listing evidence is already explicit.
      const detailIndexes = selected.map((_, index) => index).sort((left, right) =>
        Number(nativeDeferredOffices.has(selected[right])) - Number(nativeDeferredOffices.has(selected[left])))
      await Promise.all(Array.from({ length: Math.min(detailConcurrency, jobs.length) }, async () => {
        while (!detailSignal.aborted) {
          const index = detailIndexes[nextDetail++]
          if (index == null) return
          const listing = selected[index]
          const deferredOffices = nativeDeferredOffices.get(listing)
          const receiptKey = nativeDetailReceiptKey('phenom', source, baseUrl, listing,
            nativeListingSequences.get(listing), nativeListingCountries.get(listing), reviewedTitlePolicyKey,
            ...(deferredOffices ? [deferredOffices] : []))
          try {
            const cached = readNativeDetailReceipt(recovery, receiptKey)
            // A continuation must advance past already inspected, unchanged
            // roles. Keep terminal failures bound to the same exact listing
            // and the existing short-lived recovery session; they never
            // certify content. Exhausted transport failures are observations,
            // too; they must not abandon or repeatedly block an unvisited tail.
            if (['identity-mismatch', 'missing-content', 'upstream'].includes(cached?.payload?.failureKind)) {
              jobs[index].sourceDetailFailureKind = cached.payload.failureKind
              continue
            }
            const detailHtml = cached ? null : await requestWithSignal(getPage, listing.sourceUrl, detailSignal)
            const verifiedAt = cached?.fetchedAt ?? Date.now()
            const structured = cached ? cached.payload.structured : extractStructuredJobDetail(detailHtml)
            const posting = cached ? cached.payload.posting : extractJobPostingJsonLd(detailHtml)
            // Optional detail HTML must belong to the listing before it can change job identity or fields.
            const identifiers = [structured?.jobId, structured?.reqId].map(normalizeWhitespace).filter(Boolean)
            const expectedIds = [listing.jobId, listing.requisitionId]
            const listingSequence = nativeListingSequences.get(listing)
            const listingCountryCode=countryCode(nativeListingCountries.get(listing))
            const detailCountryCode=countryCode(structured?.country)
            const standardisedCountryCode=countryCode(structured?.standardisedCountry)
            const primaryCountryConflict=listingCountryCode && detailCountryCode && listingCountryCode!==detailCountryCode
              || detailCountryCode && standardisedCountryCode && detailCountryCode!==standardisedCountryCode
            const matchingNativeSequence = listingSequence && typeof structured?.jobSeqNo === 'string'
              && normalizeWhitespace(structured.jobSeqNo) === listingSequence
            const canonical = cached ? cached.payload.canonical : normalizeWhitespace(extractCanonical(detailHtml))
            const canonicalUrl = canonical ? new URL(canonical, listing.sourceUrl) : null
            const canonicalId = canonicalUrl?.pathname.split('/job/')[1]?.split('/')[0]
            const postingId = normalizeWhitespace(typeof posting?.identifier === 'string' ? posting.identifier : posting?.identifier?.value)
            const postingLocations = Array.isArray(posting?.jobLocation) ? posting.jobLocation : [posting?.jobLocation]
            const detailLocations = [
              ...(Array.isArray(structured?.multi_location) ? structured.multi_location : []),
              ...(Array.isArray(structured?.multi_location_array) ? structured.multi_location_array : []),
            ]
            const standardisedOffices = structured?.standardised_multi_location
            const invalidLocationShape = detailLocations.some(value=>!resolveDetailLocation(value, standardisedOffices).consistent)
            const detailHasTargetLocation = detailLocations.some(value => detailLocationHasTarget(value, standardisedOffices))
            const structuredCountries = [structured?.country, structured?.ml_country, structured?.standardisedCountry]
            const suppliedPostingCountries = postingLocations.map(location => location?.address?.addressCountry)
            const invalidPostingCountryShape = suppliedPostingCountries.some(country => country != null && (
              typeof country === 'string' ? !country.trim()
                : typeof country !== 'object' || Array.isArray(country) || typeof country.name !== 'string' || !country.name.trim()
                  || country['@type'] != null && country['@type'] !== 'Country'
                  || Object.keys(country).some(key => !['@type', 'name'].includes(key))
            ))
            const postingCountries = suppliedPostingCountries.map(country => country && typeof country === 'object'
              && !Array.isArray(country) ? country.name : country)
            const nativeOfficeCountries = detailLocations.map(location => countryCode(typeof location === 'string'
              ? locationParts(location).at(-1) : location?.country || locationParts(location?.cityStateCountry).at(-1)))
            const postingOfficeCountryConflict = nativeOfficeCountries.length > 0 && (!nativeOfficeCountries.every(Boolean)
              || postingCountries.some(country => countryCode(country) && !nativeOfficeCountries.includes(countryCode(country))))
            const invalidCountryShape = invalidPostingCountryShape
              || [structured?.country, structured?.standardisedCountry, ...postingCountries]
                .some(country => typeof country === 'string' && country.trim() && !countryCode(country))
              || [...structuredCountries, ...postingCountries]
              .some(country => country != null && (typeof country !== 'string'
                || country.trim() && countryParts(country).some(part => !countryNames.has(part.toLowerCase()))))
            const detailCountries = [...structuredCountries, ...postingCountries].filter(value => typeof value === 'string' && value.trim())
            const derivedCountryConflict = countryMatchesTarget(structured?.country) && typeof structured?.ml_country === 'string'
              && structured.ml_country.trim() && !countryMatchesTarget(structured.ml_country)
            const corroboratedIndiaOffices = detailLocations.filter(value => value && typeof value === 'object'
              && countryMatchesTarget(value.country) && countryMatchesTarget(locationParts(value.cityStateCountry).at(-1))
              && detailLocationHasTarget(value, standardisedOffices))
            const corroboratedDerivedConflict = !derivedCountryConflict || countryMatchesTarget(structured?.standardisedCountry)
              && corroboratedIndiaOffices.length > 0 && corroboratedIndiaOffices.length === detailLocations.length
              && (!posting || postingCountries.length > 0
                && postingCountries.every(country => countryMatchesTarget(country) || /^IN$/i.test(String(country).trim())))
            const targetDetailCountry = !primaryCountryConflict && !postingOfficeCountryConflict && !invalidCountryShape && !invalidLocationShape && corroboratedDerivedConflict && (detailHasTargetLocation || detailCountries.length > 0
              && detailCountries.every(country => countryMatchesTarget(country)
                || targetCountry === 'India' && /^IN$/i.test(country.trim())))
            const boundTargetOffices = deferredOffices ? detailLocations.filter(office => {
              if (!office || typeof office !== 'object' || Array.isArray(office) || !countryMatchesTarget(office.country)
                || !normalizeWhitespace(office.cityStateCountry) || !resolveDetailLocation(office, standardisedOffices).target) return false
              const coordinates = nativeOfficeCoordinates(office)
              return coordinates && deferredOffices.filter(observed => {
                const observedCoordinates = nativeOfficeCoordinates(observed)
                return normalizeWhitespace(observed.location) === normalizeWhitespace(office.location) && observedCoordinates
                  && coordinates.every((coordinate, index) => coordinate === observedCoordinates[index])
              }).length === 1
            }) : []
            // A missing optional model supplies no contradictory geography.
            // A supplied malformed model cannot be discarded by the array
            // extraction above while another model establishes India scope.
            const deferredLocationShape = !deferredOffices || ['multi_location', 'multi_location_array']
              .every(key => !Object.hasOwn(structured || {}, key) || Array.isArray(structured[key]))
              && (!Object.hasOwn(posting || {}, 'jobLocation') || postingLocations.length > 0
                && postingLocations.every(place => place && typeof place === 'object' && !Array.isArray(place)
                  && place.address && typeof place.address === 'object' && !Array.isArray(place.address)
                  && place.address.addressCountry != null))
            const ownedDeferredScope = !deferredOffices || boundTargetOffices.length > 0
              && matchingNativeSequence && identifiers.length === 2
              && normalizeWhitespace(structured.jobId) === listing.jobId && normalizeWhitespace(structured.reqId) === listing.requisitionId
              && normalizeWhitespace(structured.title) === listing.title && canonical === listing.sourceUrl
              && normalizeWhitespace(posting?.hiringOrganization?.name) === companyName
              && normalizeWhitespace(posting?.hiringOrganization?.url) === canonical
            // Bind an observed endpoint to raw native identity, separately from the generated role fallback.
            const detailApplyUrl = typeof structured?.applyUrl === 'string' ? normalizeWhitespace(structured.applyUrl) : null
            let ownedObservedApply = false
            if (nativeListingsWithoutApply.has(listing) && detailApplyUrl && canonical === listing.sourceUrl
              && identifiers.length > 0 && identifiers.every(id => expectedIds.includes(id))
              && typeof structured?.title === 'string' && normalizeWhitespace(structured.title) === listing.title
              && detailCountries.length > 0 && targetDetailCountry) {
              try {
                const observed = new URL(detailApplyUrl)
                ownedObservedApply = observed.protocol === 'https:' && observed.href === detailApplyUrl
                  && observed.origin === canonicalUrl.origin && canonicalUrl.origin === new URL(baseUrl).origin
                  && !observed.username && !observed.password && !observed.port && !observed.search && !observed.hash
                  && !canonicalUrl.username && !canonicalUrl.password && !canonicalUrl.port && !canonicalUrl.search && !canonicalUrl.hash
                  && observed.pathname === canonicalUrl.pathname + '/apply'
              } catch {}
            }
            const canonicalParts = canonicalUrl?.pathname.split('/job/')
            const listingPrefix = new URL(listing.sourceUrl).pathname.split('/job/')[0]
            const reviewedTitleBinding = reviewedTitleBindings.find(binding => binding.source === source
              && binding.jobId === listing.jobId && binding.reqId === listing.requisitionId
              && binding.jobId === structured?.jobId && binding.reqId === structured?.reqId
              && binding.jobSeqNo === structured?.jobSeqNo && binding.nativeTitle === structured?.title
              && binding.jsonLdTitle === posting?.title && binding.canonical === canonical
              && normalizeWhitespace(binding.listingTitle) === listing.title)
            const reviewedTitleBindingSha256 = reviewedTitleBinding
              ? nativeDetailReceiptKey('phenom-reviewed-title-binding-v1', reviewedTitleBinding) : null
            const nativeModelPreferred = nativeBoundModelTitlePreference === true && Boolean(reviewedTitleBinding) && typeof posting?.title === 'string' && posting.title.length <= 512 && normalizeWhitespace(posting.title) !== listing.title
              && typeof structured?.title === 'string' && structured.title.length <= 512
              && typeof structured.jobSeqNo === 'string' && structured.jobSeqNo.length <= 160
              && typeof canonical === 'string' && canonical.length <= 2048
              && typeof structured?.jobId === 'string' && typeof structured?.reqId === 'string'
              && normalizeWhitespace(structured.jobId) === listing.jobId && normalizeWhitespace(structured.reqId) === listing.requisitionId
              && normalizeWhitespace(structured.title) === listing.title && matchingNativeSequence
              && canonicalUrl && canonicalUrl.origin === new URL(listing.sourceUrl).origin
              && !canonicalUrl.username && !canonicalUrl.password && !canonicalUrl.search && !canonicalUrl.hash
              && canonicalParts.length === 2 && canonicalParts[0] === listingPrefix
              && canonicalParts[1].split('/').length === 2
              && (expectedIds.includes(canonicalId) || canonicalId === listingSequence)
              && (cached ? cached.payload.nativeModelPreferred === true && cached.payload.reviewedTitleBindingSha256 === reviewedTitleBindingSha256
                && hasSubstantiveNativeDescription(cached.payload.detail?.jobDescription)
                : hasSubstantiveNativeDescription(structured.ml_Description))
            if ((identifiers.length ? !identifiers.every(id => expectedIds.includes(id))
              : !posting || canonical !== listing.sourceUrl)
              || postingId && !expectedIds.includes(postingId)
              || structured?.title != null && (typeof structured.title !== 'string' || normalizeWhitespace(structured.title) !== listing.title)
              || posting?.title && normalizeWhitespace(posting.title) !== listing.title && !nativeModelPreferred
              || structured?.applyUrl != null && (typeof structured.applyUrl !== 'string'
                || normalizeWhitespace(structured.applyUrl) !== (listing.applyUrl || listing.sourceUrl)) && !ownedObservedApply
              || listingSequence && structured?.jobSeqNo != null && !matchingNativeSequence
              || canonicalUrl && (canonicalUrl.origin !== new URL(listing.sourceUrl).origin
                || !expectedIds.includes(canonicalId) && !(matchingNativeSequence && canonicalId === listingSequence))
              || !targetDetailCountry || !ownedDeferredScope || !deferredLocationShape) {
              jobs[index].sourceDetailFailureKind = 'identity-mismatch'
              rememberNativeDetailReceipt(recovery, receiptKey, { failureKind: 'identity-mismatch' }, verifiedAt)
              continue
            }
            const detail = cached ? cached.payload.detail : extractJobDetail(detailHtml, listing, nativeModelPreferred)
            if (!hasSourceDescription(detail)) {
              jobs[index].sourceDetailFailureKind = 'missing-content'
              rememberNativeDetailReceipt(recovery, receiptKey, { failureKind: 'missing-content' }, verifiedAt)
              continue
            }
            const enriched = { ...jobs[index] }
            for (const [key, value] of Object.entries(detail)) {
              if (value != null && value !== '' && (!Array.isArray(value) || value.length)) enriched[key] = value
            }
            // The verified listing identity and country remain authoritative.
            enriched.jobId = listing.jobId
            enriched.requisitionId = listing.requisitionId
            enriched.title = listing.title
            enriched.country = deferredOffices ? targetCountry : listing.country
            if (deferredOffices) {
              enriched.location = normalizeWhitespace(boundTargetOffices[0].cityStateCountry)
              enriched.city = normalizeWhitespace(boundTargetOffices[0].city)
              enriched.locations = [...new Set(detailLocations.map(office => normalizeWhitespace(
                typeof office === 'string' ? office : office.cityStateCountry || office.location)).filter(Boolean))]
            }
            enriched.sourceUrl = listing.sourceUrl
            const nativeCountryNameMappings = localizedCountryNames.filter(entry => detailCountries.some(country =>
              countryParts(country).some(part => part.toLowerCase() === entry.label.toLowerCase())))
            if (derivedCountryConflict || nativeCountryNameMappings.length || deferredOffices) enriched.sourceNativeCountryEvidence = {
              country: structured.country, standardisedCountry: structured.standardisedCountry, ml_country: structured.ml_country,
              nativeIndiaOfficeLabels: corroboratedIndiaOffices.map(value => value.cityStateCountry),
              jsonLdCountries: postingCountries, derivedCountryConflict: Boolean(derivedCountryConflict),
              ...(deferredOffices ? { verifiedSecondaryOffice: true, listingCountry: nativeListingCountries.get(listing) } : {}),
              ...(nativeCountryNameMappings.length ? { nativeCountryNameMappings: nativeCountryNameMappings.map(entry => ({ ...entry })) } : {}),
            }
            if (nativeIsoAlpha3CountryCodes) {
              const nativeCountryCodeMappings = alpha3MappingsFor(nativeListingCountries.get(listing), ...detailCountries)
              if (nativeCountryCodeMappings.length) enriched.sourceNativeCountryEvidence = {
                ...enriched.sourceNativeCountryEvidence,
                listingCountry: nativeListingCountries.get(listing),
                country: structured?.country ?? null,
                standardisedCountry: structured?.standardisedCountry ?? null,
                ml_country: structured?.ml_country ?? null,
                jsonLdCountries: postingCountries,
                nativeCountryCodeMappings: nativeCountryCodeMappings.map(entry => ({ ...entry })),
              }
            }
            if (nativeCountryBeforeZipCode) {
              const usedZipOffices = detailLocations.filter(office => resolveDetailLocation(office, standardisedOffices).nativeZipCode === true)
              if (usedZipOffices.length) enriched.sourceNativeCountryEvidence = {
                ...enriched.sourceNativeCountryEvidence,
                nativeOfficePostalCodeEvidence: {field:'zipCode',offices:usedZipOffices.map(office => structuredClone(office))},
              }
            }
            if (nativeModelPreferred) enriched.sourceNativeDetailEvidence = {
              reason: 'full-native-model-exact-role-sequence-title-and-canonical-identity',
              nativeTitle: structured.title, jsonLdTitle: posting.title, jobSeqNo: structured.jobSeqNo, canonical, reviewedTitleBindingSha256,
            }
            if (nativeStatePostalCodeFormatting) {
              const offices = detailLocations.filter(office => resolveDetailLocation(office, standardisedOffices).nativeStatePostalCode)
              if (offices.length) enriched.sourceNativeCountryEvidence = { ...enriched.sourceNativeCountryEvidence,
                nativeOfficePostalCodeEvidence: { field: 'postalCode', format: 'state-suffix', offices: structuredClone(offices) } }
            }
            enriched.link = enriched.applyUrl
            enriched.sourceDetailComplete = true
            if (recovery) {
              enriched.sourceDetailVerifiedAt = new Date(verifiedAt).toISOString()
              if (cached) enriched.sourceDetailFromRecovery = true
              else rememberNativeDetailReceipt(recovery, receiptKey, {
                // Cache the verified content and the exact evidence used by the
                // guard above, without retaining the page's UI/scripts/assets.
                structured: structured ? Object.fromEntries(['jobId', 'reqId', 'jobSeqNo', 'title', 'applyUrl', 'country',
                  'ml_country', 'standardisedCountry', 'multi_location', 'multi_location_array', 'standardised_multi_location'].filter(key => structured[key] !== undefined)
                  .map(key => [key, structured[key]])) : null,
                posting: posting ? Object.fromEntries(['identifier', 'title', 'jobLocation', 'hiringOrganization'].filter(key => posting[key] !== undefined)
                  .map(key => [key, posting[key]])) : null,
                canonical, detail, nativeModelPreferred: Boolean(nativeModelPreferred), reviewedTitleBindingSha256,
              }, verifiedAt)
            }
            delete enriched.sourceDetailFailureKind
            jobs[index] = enriched
          } catch (error) {
            signal?.throwIfAborted()
            if (detailSignal.aborted) break
            jobs[index].sourceDetailFailureKind = 'upstream'
            rememberNativeDetailReceipt(recovery, receiptKey, { failureKind: 'upstream' })
            // Listing collection is complete independently of optional detail availability.
          }
        }
      }))
    } finally {
      clearTimeout(detailTimer)
    }
    signal?.throwIfAborted()
    if (recovery) {
      recovery.pending += jobs.filter(job => job.sourceDetailFailureKind === 'budget-exhausted').length
      if (recovery.verifiedAt) attachInventoryEvidence(jobs, {
        ...readInventoryEvidence(jobs), verifiedAt: new Date(recovery.verifiedAt).toISOString(),
      })
    }
    return finalizeJobs()
  }

  return {
    buildSearchResultsPageUrl,
    buildJobDetailUrl,
    extractSearchPayload,
    extractSearchResults,
    extractJobDetail,
    run,
  }
}
