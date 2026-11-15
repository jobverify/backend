import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { fetchBazaarvoicePacket, inspectBazaarvoiceNativeListing, inspectBazaarvoiceNativeRole } from './native.js'

const CAREERS = 'https://www.bazaarvoice.com/company/careers'
const LISTING = CAREERS + '/career-job-listing'
const API = 'https://api.lever.co/v0/postings/bazaarvoice?mode=json'
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const need = (ok, message) => {
  if (!ok) throw Object.assign(new Error('Bazaarvoice current native handoff: ' + message), {
    abortRetries: true, softFailure: true, failureKind: 'surface_drift_or_fail_closed',
  })
}
const roleLinks = html => {
  const doc = readNativeDocument(html), links = new Map()
  for (const node of doc.nodes(node => node.tag === 'a' && node.attrs.href && !node.inert)) {
    const url = node.attrs.href
    if (/^https:\/\/jobs\.lever\.co\/bazaarvoice\/[a-f\d-]{36}$/.test(url)) {
      if (!links.has(url)) links.set(url, [])
      links.get(url).push(text(doc.text(node)))
    }
  }
  return links
}

// The employer replaced its WordPress controller with a Next page and a linked
// SSR listing. This path qualifies explicit current India positives only. The
// listing's pagination/rendering and all employer channels remain unqualified.
export async function runCurrentBazaarvoice(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(85000)])
  const receipts = []
  let initial = options.initialPacket || null
  const read = async (url, redirect = false) => {
    signal.throwIfAborted()
    let packet
    try {
      if (initial && url === CAREERS + '/') { packet = initial; initial = null }
      else packet = options.readPacket ? await options.readPacket(url, { method: 'GET', redirect: 'manual', signal })
        : await fetchBazaarvoicePacket(url, { signal, fetchImpl: options.fetchImpl,
          requestTimeoutMs: 20000, maximumBytes: 2 * 1024 * 1024 })
    }
    catch (error) {
      if (!redirect || !error.retainedResponse) throw error
      packet = error.retainedResponse
    }
    signal.throwIfAborted()
    need(packet?.url === url && typeof packet.body === 'string' && packet.bytes === Buffer.byteLength(packet.body)
      && packet.bytes <= 2 * 1024 * 1024 && packet.sha256 === createHash('sha256').update(packet.body).digest('hex')
      && packet.headers && typeof packet.headers === 'object', 'native retained response identity changed')
    need(redirect || packet.status === 200, 'native response HTTP ' + packet.status)
    receipts.push(packet)
    return packet
  }
  const redirect = await read(CAREERS + '/', true)
  need(redirect.status === 308 && redirect.url === CAREERS + '/'
    && redirect.headers.location === '/company/careers', 'current employer canonical redirect changed')
  const employer = await read(CAREERS)
  const document = readNativeDocument(employer.body)
  need(document.nodes(node => node.tag === 'title').some(node => text(node.raw) === 'Bazaarvoice | Career')
    && document.nodes(node => node.tag === 'a' && !node.inert && node.attrs.href === '/company/careers/career-job-listing')
      .some(node => /see current job openings/i.test(document.text(node))), 'current corporate listing handoff unavailable')
  const listing = await read(LISTING)
  const listingDocument = readNativeDocument(listing.body)
  need(listingDocument.nodes(node => node.tag === 'title').some(node => text(node.raw) === 'Bazaarvoice | Career Listing Page'),
    'current corporate listing identity unavailable')
  const links = roleLinks(listing.body)
  const opening = await read(API)
  const native = inspectBazaarvoiceNativeListing(opening.body, opening.headers)
  const facts = [], held = []
  for (const row of native.records) {
    if (row.country !== 'IN') continue
    const labels = links.get(row.hostedUrl) || []
    if (!labels.some(label => label.startsWith(row.text + ' ') && label.includes(row.categories.location))) {
      held.push({ jobId: row.id, reason: 'current-active-corporate-role-link-or-title-unavailable' }); continue
    }
    // A Lever primary country cannot scope several unrelated secondary places.
    if (row.categories.allLocations.length !== 1 || row.categories.allLocations[0] !== row.categories.location) {
      held.push({ jobId: row.id, reason: 'native-secondary-country-scope-unresolved' }); continue
    }
    const detail = await read(row.hostedUrl)
    const fact = inspectBazaarvoiceNativeRole(detail.body, row)
    const countries = fact.addresses.map(address => text(address.addressCountry)).filter(Boolean)
    if (countries.some(country => !/^(?:IN|IND|India)$/i.test(country))) {
      held.push({ jobId: row.id, reason: 'native-schema-country-conflict' }); continue
    }
    facts.push(fact)
  }
  const closingPacket = await read(API)
  const closing = inspectBazaarvoiceNativeListing(closingPacket.body, closingPacket.headers)
  const current = new Map(closing.records.map(row => [row.id, row]))
  const jobs = facts.filter(fact => {
    if (isDeepStrictEqual(fact.row, current.get(fact.row.id))) return true
    held.push({ jobId: fact.row.id, reason: 'closing-native-role-record-changed' }); return false
  }).map(fact => ({ title: fact.row.text, company: 'Bazaarvoice', source: 'bazaarvoice', jobId: fact.row.id,
    requisitionId: fact.row.id, country: 'India', city: fact.row.categories.location.split(',')[0].trim(),
    location: fact.row.categories.location, sourceUrl: fact.row.hostedUrl, applyUrl: fact.row.applyUrl, link: fact.row.applyUrl,
    jobDescription: fact.descriptionHTML, sourceDescription: fact.descriptionHTML,
    employmentType: fact.row.categories.commitment || null, department: fact.row.categories.department || null,
    remoteStatus: ({ remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' })[fact.row.workplaceType] || null,
    postingDate: fact.posted.iso, closingDate: fact.closing.iso, sourcePostedDatePrecision: fact.posted.precision,
    nativeListingRecord: fact.row, nativeJobPosting: fact.schema, nativeCreatedAt: fact.row.createdAt ?? null,
    companyCareerPage: CAREERS + '/', companyDomain: 'bazaarvoice.com', atsPlatform: 'lever',
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    sourceDetailComplete: true, scrapedAt: closingPacket.completedAt }))
  const audit = { source: 'bazaarvoice', nativeRecords: native.rows, originalClosing: closing.rows,
    observedListingCount: native.rows.length, observedIndiaListingCount: facts.length, facts,
    wholeCompanyScopeComplete: false, retainedResponses: receipts, failures: held,
    corporateNativeRoleLinks: Object.fromEntries(links), held, receipts,
    issues: [...native.issues, ...closing.issues], sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit })
  Object.defineProperty(jobs, Symbol.for('jobverify.bazaarvoice-public-inventory'), { value: audit })
  await options.onProof?.(audit); signal.throwIfAborted()
  await options.onAudit?.(structuredClone(audit)); signal.throwIfAborted()
  attachSourceObservationEvidence(jobs, { source: 'bazaarvoice', recordKind: 'vacancy-rows',
    observedRecordCount: native.rows.length, observedVacancyCount: native.rows.length,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: API, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: receipts.length,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: closingPacket.completedAt,
    reason: 'current-Next-corporate-role-handoff-and-original-Lever-India-role-reconciled;whole-source-scope-unqualified' })
}
