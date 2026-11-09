import { createPublicAtsCatalogScraper } from '../../scraper-support/providers/index.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { isDeepStrictEqual } from 'node:util'

export const FINIX_API = 'https://api.lever.co/v0/postings/finix?mode=json'
const provider = {
  source: 'finix', companyName: 'Finix', atsPlatform: 'lever', boardToken: 'finix',
  countryFilter: 'India', companyCareerPage: 'https://finix.com/careers',
  bindingEvidence: { verified: true, officialURL: 'https://finix.com/careers',
    matchedLinks: ['https://jobs.lever.co/finix'] },
}
const text = value => typeof value === 'string' && value.trim() !== ''
const normalizeLabel = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : value
const foreignLabels = new Set(['San Francisco', 'Chicago', 'Orlando', 'Toronto', 'Vancouver'])
const foreignCountries = new Set(['United States of America', 'USA', 'U.S.A.', 'U.S.', 'US',
  'UK', 'UAE', 'CA', 'CAN', 'SG', 'SGP', 'AU', 'AUS', 'GB', 'GBR'])
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
  const code = String.fromCharCode(first, second), name = regionNames.of(code)
  if (code !== 'IN' && name && name !== code) foreignCountries.add(name)
}
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const foreignGeography = new RegExp(`(?:^|[^\\p{L}])(?:${[...foreignCountries, ...foreignLabels]
  .sort((a, b) => b.length - a.length).map(escapePattern).join('|')})(?=$|[^\\p{L}])`, 'iu')
const explicitForeignCountry = new RegExp(`(?:^|[^\\p{L}])(?:${[...foreignCountries]
  .sort((a, b) => b.length - a.length).map(escapePattern).join('|')})(?=$|[^\\p{L}])`, 'iu')
const unboundedLocation = /^(?:remote|worldwide|anywhere|global)$/i
// The common public scope helper accepts plain Remote. It is not native India evidence.
const indiaLabel = value => text(value) && !unboundedLocation.test(normalizeLabel(value))
  && isIndiaJob({ location: normalizeLabel(value) })
const nativeBody = record => {
  const body = record.descriptionBodyPlain || record.descriptionBody
  const split = [record.openingPlain || record.opening, body].filter(text)
  return text(body) ? split.join('\n\n')
    : record.descriptionPlain || record.description || split.join('\n\n') || null
}
const descriptionFields = ['openingPlain', 'opening', 'descriptionPlain', 'description',
  'descriptionBodyPlain', 'descriptionBody', 'additionalPlain', 'additional',
  'salaryDescriptionPlain', 'salaryDescription']

const nativePublication = record => {
  for (const field of ['publishedAt', 'postedAt', 'firstPublishedAt', 'first_published']) {
    if (record[field] != null) throw new Error('[finix] Unsupported explicit publication contract')
  }
  if (record.datePosted == null) return null
  const value = record.datePosted
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new Error('[finix] Invalid native publication date')
  }
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`), date = new Date(value)
  if (!Number.isFinite(day.getTime()) || !Number.isFinite(date.getTime())
    || day.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error('[finix] Invalid native publication date')
  return date.toISOString()
}

const validateLifecycle = record => {
  for (const field of ['status', 'state', 'publicationStatus']) {
    if (Object.hasOwn(record, field) && record[field] !== 'published') throw new Error('[finix] Unsupported native lifecycle status')
  }
  for (const field of ['isListed', 'isPublished', 'isActive', 'active', 'published']) {
    if (Object.hasOwn(record, field) && record[field] !== true) throw new Error('[finix] Contradictory published lifecycle contract')
  }
  if (Object.hasOwn(record, 'closed') && record.closed !== false) throw new Error('[finix] Contradictory closed lifecycle status')
}

const substantiveRole = record => {
  // Company openings, closing/legal text and salary prose cannot supply the core JD.
  const content = extractActiveDescription([record.descriptionBodyPlain || record.descriptionBody
    || record.descriptionPlain || record.description,
  ...(record.lists || []).map(section => section.content)].filter(text).join('\n\n'))
  if (!content) return false
  const role = content.split(/(?<=[.!?])\s+/).filter(sentence =>
    !/equal opportunity|do not discriminate|protected characteristics|privacy policy|value diversity/i.test(sentence)).join(' ')
  return role.replace(/[^\p{L}\p{N}]/gu, '').length >= 30
    && /\b(?:build|maintain|develop|operate|own|manage|lead|design|support|implement|deliver|experience|requirements|qualifications|responsibilities|responsible|skills|duties|you will|your role|engineering)\b/i.test(role)
}

// Add native secondary scope and creation metadata at the shared Lever boundary.
// The shared adapter owns complete-array extraction, full sections and evidence.
export async function runNativeFinix({
  fetchJson = (url, options) => fetchJsonWithRetry(url, {
    ...options, attempts: 1, timeoutMs: 20000, label: 'finix',
  }), signal, onAudit = () => {},
} = {}) {
  signal?.throwIfAborted()
  const records = await fetchJson(FINIX_API, { signal })
  signal?.throwIfAborted()
  if (!Array.isArray(records)) throw new Error('[finix] Invalid or failed Lever inventory envelope/pagination')
  const opening = structuredClone(records)
  const identities = new Set(), originals = new Map(), unknownReasons = new Set()
  const publication = new Map(), missingRoleDescriptions = new Set()
  const prepared = records.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || !text(record.id) || !text(record.text) || identities.has(record.id)) {
      throw new Error('[finix] Invalid or repeated native inventory identity')
    }
    identities.add(record.id)
    validateLifecycle(record)
    publication.set(record.id, nativePublication(record))
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.id)) {
      throw new Error('[finix] Invalid native identity')
    }
    for (const [field, suffix] of [['hostedUrl', ''], ['applyUrl', '/apply']]) {
      if (record[field] !== `https://jobs.lever.co/finix/${record.id}${suffix}`) {
        throw new Error('[finix] Foreign or invalid application identity')
      }
    }
    if (!record.categories || typeof record.categories !== 'object' || Array.isArray(record.categories)) {
      throw new Error('[finix] Invalid native location inventory')
    }
    const rawPrimary = record.categories.location, rawSecondary = record.categories.allLocations
    if (rawPrimary != null && typeof rawPrimary !== 'string') throw new Error('[finix] Invalid native primary location')
    if (rawSecondary != null && (!Array.isArray(rawSecondary) || rawSecondary.some(label => !text(label)))) {
      throw new Error('[finix] Invalid native secondary location inventory')
    }
    const primary = normalizeLabel(rawPrimary), secondary = rawSecondary?.map(normalizeLabel)
    if (!text(primary) || !secondary?.length) unknownReasons.add('native-location-scope-unavailable')
    const labels = [...new Set([primary, ...(secondary || [])].filter(text))]
    for (const label of labels) {
      if (indiaLabel(label) && foreignGeography.test(label)) throw new Error('[finix] Contradictory explicit location geography')
      if (unboundedLocation.test(label)) unknownReasons.add('secondary-remote-scope-unresolved')
      else if (!indiaLabel(label) && !foreignLabels.has(label) && !foreignGeography.test(label)) unknownReasons.add('native-location-scope-unresolved')
    }
    if (record.country != null && typeof record.country !== 'string') throw new Error('[finix] Invalid native country')
    const countryIndia = /^(?:IN|IND|India)$/i.test(record.country || '')
    if ((indiaLabel(primary) && text(record.country) && !countryIndia)
      || (countryIndia && foreignGeography.test(primary || ''))) {
      throw new Error('[finix] Contradictory primary country/location')
    }
    for (const field of descriptionFields) {
      if (record[field] != null && typeof record[field] !== 'string') throw new Error('[finix] Invalid native description inventory')
    }
    if (record.lists != null && (!Array.isArray(record.lists) || record.lists.some(section =>
      !section || typeof section !== 'object'
      || (section.text != null && typeof section.text !== 'string')
      || (section.content != null && typeof section.content !== 'string')))) {
      throw new Error('[finix] Invalid native description sections')
    }
    const india = labels.filter(indiaLabel)
    if (countryIndia && /^remote$/i.test(primary || '')) india.unshift('Remote, India')
    if (india.length && !substantiveRole(record)) {
      missingRoleDescriptions.add(record.id)
      unknownReasons.add('selected-role-substantive-description-unavailable')
    }
    const location = india.length
      ? india.map(label => /\bindia\b/i.test(label) ? label : `${label}, India`).join(' / ') : primary
    const primaryCountryName=countryIndia?'India':/^[A-Z]{2}$/i.test(record.country||'')
      ? regionNames.of(record.country.toUpperCase()):null
    const qualifiedPrimary=primaryCountryName && primaryCountryName!==record.country
      && text(primary) && !unboundedLocation.test(primary) && !indiaLabel(primary) && !explicitForeignCountry.test(primary)
      ? `${primary}, ${primaryCountryName}`:primary
    originals.set(record.id, record)
    return {
      ...record, ...(india.length?{country:'IN'}:{}), createdAt: null, descriptionPlain: nativeBody(record), description: null,
      additionalPlain: [record.additionalPlain || record.additional,
        record.salaryDescriptionPlain || record.salaryDescription].filter(text).join('\n\n') || null,
      additional: null, categories: { ...record.categories, location,
        ...(secondary?{allLocations:secondary.map(label=>label===primary?qualifiedPrimary:label)}:{}) },
    }
  })
  const mapped = await createPublicAtsCatalogScraper(provider).run({ signal, fetchJson: async () => prepared })
  signal?.throwIfAborted()
  const closing = await fetchJson(FINIX_API, { signal })
  signal?.throwIfAborted()
  // Compare every native field, including unknown nested criteria. Only array
  // ordering may change; the original opening/closing arrays remain intact.
  if (!Array.isArray(closing) || closing.length !== opening.length
    || !isDeepStrictEqual(new Map(opening.map(record => [record.id, record])),
      new Map(closing.map(record => [record?.id, record])))) {
    throw new Error('[finix] Closing native inventory identity, schema or criteria changed')
  }
  const evidence = readInventoryEvidence(mapped)
  const incomplete = unknownReasons.size > 0 || evidence?.listingComplete !== true
  const jobs = mapped.filter(job => !missingRoleDescriptions.has(job.jobId)).map(job => {
    const native = originals.get(job.jobId)
    return {
      ...job, postingDate: publication.get(job.jobId) ?? null, nativeCreatedAt: native?.createdAt ?? null, nativeRecord: native,
      remoteStatus: ({ remote: 'Remote', onsite: 'On-site', 'on-site': 'On-site', hybrid: 'Hybrid' })[native?.workplaceType] ?? null,
      ...(incomplete ? { sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false } : {}),
    }
  })
  const audit = {
    opening, closing: structuredClone(closing), reconciled: true,
    observedNativeCount: opening.length,
    companyGlobalTotal: null, companyIndiaTotal: null,
    lifecycleCleanupAllowed: false,
  }
  Object.defineProperty(jobs, 'nativeClosingEvidence', { value: audit })
  // Registered provider decoration creates a new array. This callback preserves
  // source-native proof access without changing that shared decorator.
  await onAudit(structuredClone(audit))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, {
    ...evidence, status: incomplete ? 'coverage-gap' : evidence.status, listingComplete: !incomplete,
    verifiedAt: incomplete ? null : evidence?.verifiedAt ?? null,
    reportedTotal: records.length, indiaFacetCount: unknownReasons.size ? null : jobs.length,
    reason: incomplete ? `finix-native-scope-incomplete:${[...unknownReasons,
      evidence?.listingComplete ? '' : evidence?.reason].filter(Boolean).join(';')}` : evidence.reason,
  })
}
