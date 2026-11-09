import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://www.sightspectrum.com/careers'
export const PUBLIC_SCOPE_URLS = [CAREERS_URL, 'https://www.sightspectrum.com/', 'https://www.sightspectrum.com/job-board-and-careers-page', 'https://www.sightspectrum.com/getintouch']
const SOURCE = 'sightspectrumtechnologysolutions'
const digest = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw new Error(`SightSpectrum native careers: ${message}`) }
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const experience = value => norm(value).match(/\b\d+(?:\s*[-–]\s*\d+)?\+?\s+years?\b/i)?.[0] || null
const schemaKeys = ['@context', '@type', 'title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation']
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

// These observations deliberately do not certify Wix hydration, CSS visibility,
// country, or complete inventory. Both raw records and all JD bytes survive.
export const inspectSightSpectrumCareers = html => {
  const doc = readNativeDocument(html)
  const text = doc.text(doc.nodes(node => node.tag === 'root')[0])
  if (!text.includes('Join Our Team') || !text.includes('positions currently open at SightSpectrum')) fail('verified SightSpectrum Technology Solutions careers surface changed')
  const records = []
  for (const node of doc.nodes(node => node.tag === 'script' && /^application\/ld\+json$/i.test(node.attrs.type || ''))) {
    let record
    try { record = JSON.parse(node.raw) } catch { fail('Malformed native JSONLD') }
    if (record?.['@type'] === 'JobPosting') records.push(record)
    else if (record?.['@graph'] || Array.isArray(record)) fail('Unreviewed native JSONLD envelope')
  }
  if (!records.length) fail('Missing native JobPosting records; cannot prove empty')
  const cards = doc.nodes(node => /^comp-moi9zxh9_r_comp-m056d1y7__/.test(node.attrs.id || '')).map(node => ({
    id: node.attrs.id.match(/__([0-9a-f-]{36})$/)?.[1], title: doc.text(node), attrs: node.attrs,
  }))
  const seen = new Set()
  const jobs = records.map(record => {
    if (typeof record.title !== 'string' || !norm(record.title)) fail('Invalid native title identity')
    if (seen.has(record.title)) fail('Duplicate native title identity')
    seen.add(record.title)
    const matching = cards.filter(card => card.title === record.title && card.id)
    const bound = matching.length === 1
    const id = bound ? matching[0].id : null
    const rawDescription = record.description
    const description = typeof rawDescription === 'string' ? extractActiveDescription(rawDescription) : null
    const gaps = ['native-country-unresolved', 'wix-visibility-and-inventory-unreviewed']
    if (!bound) gaps.push('native-visible-role-binding-unresolved')
    const schema = exactKeys(record, schemaKeys) && record['@context'] === 'https://schema.org/'
      && typeof record.description === 'string' && typeof record.datePosted === 'string' && !Number.isNaN(Date.parse(record.datePosted))
      && exactKeys(record.hiringOrganization, ['@type', 'name']) && record.hiringOrganization['@type'] === 'Organization' && record.hiringOrganization.name === 'Sightspectrum_Website_New'
      && exactKeys(record.jobLocation, ['@type', 'address']) && record.jobLocation['@type'] === 'Place' && typeof record.jobLocation.address === 'string'
    if (!schema) gaps.push('unreviewed-native-schema')
    if (!description) gaps.push('native-description-unresolved')
    if (record.title === 'UI/UX Designer' && /Frontend Engineer/i.test(description || '')) gaps.push('native-title-description-discrepancy')
    const visibleDescriptionMatch = description ? doc.nodes(node => (node.attrs.id || '').endsWith(`__${id}`)).some(node => doc.text(node) === description) : false
    if (!visibleDescriptionMatch) gaps.push('native-visible-criteria-binding-unresolved')
    return {
      title: record.title, company: 'SightSpectrum Technology Solutions', jobId: id, requisitionId: id,
      location: typeof record.jobLocation?.address === 'string' ? record.jobLocation.address : null,
      city: null, country: null, sourceUrl: CAREERS_URL, applyUrl: null, link: CAREERS_URL,
      department: null, employmentType: null, remoteStatus: null,
      experienceRequired: description ? experience(description) : null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [],
      postingDate: typeof record.datePosted === 'string' && !Number.isNaN(Date.parse(record.datePosted)) ? record.datePosted : null, closingDate: null,
      jobDescription: description, sourceDescription: typeof rawDescription === 'string' ? rawDescription : null,
      sourceNativeRecord: record, sourceNativeVisibleCard: bound ? matching[0] : null,
      sourceScopeGaps: gaps, sourceListingComplete: false, sourceDetailComplete: false,
      sourceCriteriaComplete: false, sourceCountryScopeVerified: false,
      lifecycleCleanupAllowed: false, sourceScopeComplete: false,
    }
  })
  const ids = jobs.map(job => job.jobId).filter(Boolean)
  if (new Set(ids).size !== ids.length || new Set(cards.map(card => card.id)).size !== cards.length) fail('Duplicate native role identity')
  return { jobs, rawRecords: records, observedCards: cards }
}

const channels = document => {
  const doc = readNativeDocument(document.html)
  return [
    ...doc.nodes(node => node.tag === 'a' && node.attrs.href).filter(node => /career|job|apply|recruit/i.test(node.attrs.href + ' ' + doc.text(node))).map(node => ({ page: document.url, type: 'link', href: node.attrs.href, text: doc.text(node), attrs: node.attrs })),
    ...doc.nodes(node => node.tag === 'form').map(node => ({ page: document.url, type: 'form', attrs: node.attrs, text: doc.text(node) })),
    ...activeIframeSources(document.html).map(src => ({ page: document.url, type: 'frame', src })),
  ]
}

export const runCurrentSightSpectrum = async ({ fetchImpl = globalThis.fetch, fetchText, signal, maxResponseBytes = 8 * 1024 * 1024, maxJobs, countryFilter = 'India', onAudit, now = () => new Date().toISOString() } = {}) => {
  if (fetchText && fetchImpl === globalThis.fetch) fail('Body-only transport unsupported; observed HTTP response metadata required')
  if (!['India', 'Global'].includes(countryFilter)) fail('Unsupported country filter')
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 8 * 1024 * 1024) fail('Invalid response byte cap')
  const documents = []
  const read = async url => {
    signal?.throwIfAborted()
    const timeout = AbortSignal.timeout(30000), requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
    const response = await fetchImpl(url, { redirect: 'follow', signal: requestSignal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html' } })
    requestSignal.throwIfAborted()
    if (response?.status !== 200 || response.url !== url || !/^text\/html(?:\s*;|$)/i.test(response.headers?.get('content-type') || '') || !response.body?.getReader) fail('HTTP/URL/MIME response identity unresolved')
    const reader = response.body.getReader(), chunks = []; let bytes = 0
    try {
      for (;;) {
        requestSignal.throwIfAborted()
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.length
        if (bytes > maxResponseBytes) fail('Response byte cap exceeded')
        chunks.push(Buffer.from(value))
      }
    } finally { await reader.cancel().catch(() => {}) }
    requestSignal.throwIfAborted()
    const body = Buffer.concat(chunks), row = { url, finalUrl: response.url, status: response.status, contentType: response.headers.get('content-type'), bytes, sha256: digest(body), html: new TextDecoder().decode(body) }
    documents.push(row)
    return row
  }
  for (const url of PUBLIC_SCOPE_URLS) await read(url)
  const opening = inspectSightSpectrumCareers(documents[0].html)
  if (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < opening.jobs.length)) fail('Native role cap cannot truncate unknown inventory')
  for (const url of PUBLIC_SCOPE_URLS) await read(url)
  const closing = inspectSightSpectrumCareers(documents[4].html)
  const verifiedAt = now(), openingClosingMatch = documents.slice(0, 4).every((row, index) => row.sha256 === documents[index + 4].sha256)
  const audit = {
    source: SOURCE, verifiedAt, classification: 'guard-repaired-scope-unresolved',
    listingComplete: false, cleanupEligible: false, reportedTotal: null, indiaFacetCount: null,
    observedNativeRecordCount: opening.jobs.length, unknownCountryCount: opening.jobs.length,
    openingClosingMatch, nativeRecords: opening.jobs, closingNativeRecords: closing.jobs,
    documents, channels: documents.flatMap(channels),
    gaps: ['native-country-unresolved', 'additional-hiring-channels-unresolved', 'wix-visibility-and-inventory-unreviewed', ...(!openingClosingMatch ? ['opening-closing-source-drift'] : [])],
  }
  await onAudit?.(audit)
  signal?.throwIfAborted()
  // Countryless observations are available only for explicit global inspection.
  // They cannot become eligible India jobs or a verified India zero.
  const jobs = countryFilter === 'Global' ? opening.jobs.map(job => ({ ...job, source: SOURCE, scrapedAt: verifiedAt })) : []
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched: documents.length, reportedTotal: null, indiaFacetCount: null, verifiedAt, reason: 'sightspectrum-native-country-and-inventory-scope-unresolved' })
}
