import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readLiteralFlightRecords } from '../../scraper-support/utils/kulaFlight.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const ORIGIN = 'https://jobs.iqvia.com'
const JOBS = `${ORIGIN}/en/jobs`
// Current active JobCard module 35576 renders /jobs/{instance_id} through its
// locale-aware link. Fail closed when that declared program changes.
const ROUTE_CLIENT = `${ORIGIN}/_next/static/chunks/6245-24d5a5525a17fb26.js`
const ROUTE_SHA256 = '730a8dce4a2c46eac25360d8683cf74788fdb2f55823a9bff06228f5e02b5857'
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw Object.assign(new Error(`IQVIA current native ${message}`), {
  abortRetries: true, softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
}) }
const requireNative = (condition, message) => { if (!condition) fail(message) }
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim() === value && value.length > 0

function readPage(html) {
  const document = readNativeDocument(html)
  const scripts = document.nodes(node => node.tag === 'script' && !node.attrs.src
    && (!node.attrs.type || /^(?:text|application)\/javascript$/i.test(node.attrs.type)))
  const frames = scripts.filter(node => node.raw?.trim().startsWith('self.__next_f.push('))
  if (!frames.length) return { document, records: null }
  const records = readLiteralFlightRecords(frames.map(node => `<script>${node.raw}</script>`).join(''))
  return { document, records }
}
function models(records, predicate) {
  const found = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (predicate(value)) found.push(value)
    for (const child of Object.values(value)) visit(child)
  }
  for (const record of records?.values() || []) if (record.kind === 'model') visit(record.value)
  if (!found.length) return null
  requireNative(new Set(found.map(value => JSON.stringify(value))).size === 1, 'model is conflicting')
  return found[0]
}
function assertPage(document, url) {
  const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  const titles = document.nodes(node => node.tag === 'title')
  requireNative(canonicals.length === 1 && canonicals[0].attrs.href === url, 'canonical identity is unavailable or changed')
  requireNative(titles.length === 1 && /\bIQVIA\b/.test(titles[0].raw || ''), 'publisher title identity is unavailable')
}

// Passive Cloudflare JavaScript detection occurs after a successful response.
// This qualifies only an active current native model at its own canonical URL;
// the caller still rejects visible challenges and subsequently validates data.
export function hasCurrentIqviaEnvelope(html, url) {
  const { document, records } = readPage(html)
  if (!records) return false
  const catalog = url === JOBS && models(records, value => Array.isArray(value.jobs) && Object.hasOwn(value, 'children'))
  const own = /^https:\/\/jobs\.iqvia\.com\/en\/jobs\/R\d+-\d+$/.test(url)
    && models(records, value => plain(value.job) && text(value.job.instance_id))
  if (!catalog && !own) return false
  assertPage(document, url)
  return true
}

export function readCurrentIqviaListing(html) {
  const { document, records } = readPage(html)
  if (!records) return null
  const model = models(records, value => Array.isArray(value.jobs) && Object.hasOwn(value, 'children'))
  if (!model) return null
  assertPage(document, JOBS)
  requireNative(model.jobs.length <= 10000, 'listing model exceeds the bounded instance count')
  const clients = document.nodes(node => node.tag === 'script' && node.attrs.src)
    .map(node => new URL(node.attrs.src, ORIGIN).href)
  requireNative(clients.includes(ROUTE_CLIENT), 'declared route client identity changed')
  const seen = new Set()
  for (const row of model.jobs) {
    const match = typeof row?.instance_id === 'string' && /^(R\d+)-\d+$/.exec(row.instance_id)
    requireNative(match && row.job_req_id === match[1] && !seen.has(row.instance_id) && text(row.job_title), 'listing instance identity is invalid or duplicated')
    seen.add(row.instance_id)
    requireNative(plain(row.job_location?.address) && text(row.job_location.address.country), 'listing has an unresolved worksite country')
  }
  return { rows: model.jobs, routeClient: ROUTE_CLIENT, modelSha256: hash(JSON.stringify(model.jobs)) }
}

function readDescription(records, value, seen = new Set()) {
  requireNative(typeof value === 'string', 'full description is unavailable')
  const reference = /^\$([a-f\d]+)$/i.exec(value)
  if (!reference) return value
  requireNative(!seen.has(reference[1]), 'description reference is cyclic')
  seen.add(reference[1])
  const record = records.get(reference[1])
  requireNative(record && typeof record.value === 'string', 'description reference is unavailable')
  return record.kind === 'text' ? record.value : readDescription(records, record.value, seen)
}
function extractDetail(html, listing) {
  const sourceUrl = `${JOBS}/${listing.instance_id}`
  const { document, records } = readPage(html)
  requireNative(records, 'own detail model is unavailable')
  assertPage(document, sourceUrl)
  const own = models(records, value => plain(value.job) && text(value.job.instance_id))?.job
  requireNative(own && own.instance_id === listing.instance_id && own.job_req_id === listing.job_req_id
    && own.job_title === listing.job_title && same(own.job_location, listing.job_location)
    && own.date_posted === listing.date_posted, 'own instance, requisition, title, date or worksite identity differs from listing')
  const schemas = document.nodes(node => node.tag === 'script' && node.attrs.id === 'job-posting-schema'
    && node.attrs.type === 'application/ld+json' && !node.attrs.src)
  requireNative(schemas.length === 1, 'own JobPosting identity is unavailable or ambiguous')
  let schema
  try { schema = JSON.parse(schemas[0].raw) } catch { fail('own JobPosting JSON is malformed') }
  requireNative(schema['@context'] === 'https://schema.org' && schema['@type'] === 'JobPosting'
    && schema.url === sourceUrl && schema.title === own.job_title
    && schema.identifier?.name === 'IQVIA' && schema.identifier?.value === own.job_req_id
    && schema.datePosted === own.date_posted, 'own JobPosting identity differs from native instance')
  requireNative(schema.hiringOrganization?.['@type'] === 'Organization' && schema.hiringOrganization.name === 'IQVIA'
    && schema.hiringOrganization.sameAs === 'https://www.iqvia.com', 'own employer identity is unavailable or changed')
  const address = own.job_location.address, place = schema.jobLocation
  requireNative(place?.['@type'] === 'Place' && place.address?.['@type'] === 'PostalAddress'
    && address.country === 'India' && place.address.addressCountry === 'India'
    && (address.city || null) === (place.address.addressLocality || null)
    && (address.region || null) === (place.address.addressRegion || null), 'own independently typed country or worksite differs')
  const headings = document.nodes(node => node.tag === 'h1')
  requireNative(headings.length === 1 && document.text(headings[0]) === own.job_title.replace(/\s+/g, ' ').trim(), 'own visible title identity differs')
  const description = readDescription(records, own.job_description)
  const jobDescription = extractActiveDescription(description)
  requireNative(jobDescription, 'own full description and criteria are unavailable')
  requireNative(jobDescription === extractActiveDescription(schema.description), 'own full description disagrees with JobPosting')
  const apply = new URL(own.application_url)
  requireNative(apply.protocol === 'https:' && apply.hostname === 'iqvia.wd1.myworkdayjobs.com'
    && apply.pathname.startsWith('/IQVIA/job/') && new RegExp(`_${own.job_req_id}(?:-\\d+)?$`).test(apply.pathname)
    && !apply.search && !apply.hash, 'own declared application identity changed')
  return { title: own.job_title, location: [address.city, address.region, address.country].filter(Boolean).join(', '),
    city: address.city || null, country: address.country, jobId: own.instance_id, requisitionId: own.job_req_id,
    sourceUrl, applyUrl: apply.href, postingDate: own.date_posted, workplaceType: null, requiredSkills: [], jobDescription,
    nativeTitle: own.job_title, nativeLocation: structuredClone(address), nativeRequisitionId: own.job_req_id,
    nativeInstanceId: own.instance_id, nativeEmploymentType: own.employment_type,
    nativeFullDescription: description, nativeEmployer: structuredClone(schema.hiringOrganization),
    nativeJobPosting: structuredClone(schema) }
}

export async function runCurrentIqvia({ opening, read, normalize, signal }) {
  const validateRoute = async model => requireNative(hash(await read(model.routeClient)) === ROUTE_SHA256, 'route client program changed')
  await validateRoute(opening)
  const india = opening.rows.filter(row => row.job_location.address.country === 'India')
  const retained = new Array(india.length)
  let next = 0
  const hydrate = async (closing, indices) => {
    next = 0
    let failure
    const failures = []
    await Promise.allSettled(Array.from({ length: Math.min(4, indices.length) }, async () => {
      let activeIndex
      try {
        while (!failure && next < indices.length) {
          signal.throwIfAborted()
          const index = indices[next++], listing = india[index]
          activeIndex = index
          const detail = extractDetail(await read(`${JOBS}/${listing.instance_id}`), listing)
          if (closing) requireNative(same(retained[index], detail), 'closing own detail identity, country, date or full description changed')
          else retained[index] = detail
        }
      } catch (error) {
        failure ||= error
        failures.push({ instanceId: india[activeIndex]?.instance_id || null,
          sourceUrl: activeIndex === undefined ? null : `${JOBS}/${india[activeIndex].instance_id}`,
          status: error.status || null, message: error.message })
      }
    }))
    return { failure, failures }
  }
  const openingDetails = await hydrate(false, india.map((_row, index) => index))
  const retainedIndices = india.flatMap((_row, index) => retained[index] ? [index] : [])
  // A public detail denial cannot certify any unread role. Preserve only roles
  // already fully observed before the stop, then freshly recheck those exact
  // successful URLs. Denied URLs are never retried or replaced by another ATS.
  if (openingDetails.failure && (!retainedIndices.length
    || openingDetails.failures.some(item => item.status !== 403))) throw openingDetails.failure
  const closingDetails = await hydrate(true, retainedIndices)
  if (closingDetails.failure) throw closingDetails.failure
  const closing = readCurrentIqviaListing(await read(JOBS))
  requireNative(closing && same(opening.rows, closing.rows), 'closing listing instances, typed worksites or dates changed')
  await validateRoute(closing)
  signal.throwIfAborted()
  const jobs = retainedIndices.map(index => normalize(retained[index]))
  const heldNativeIndiaInstances = india.flatMap((row, index) => retained[index] ? [] : [{
    row: structuredClone(row), detailStatus: openingDetails.failures.some(item => item.instanceId === row.instance_id) ? 'denied-403' : 'not-read',
  }])
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: {
    kind: 'iqvia-current-native-flight-instances', nativeListingInstances: opening.rows.length,
    retainedIndiaInstances: jobs.length, listingModelSha256: opening.modelSha256,
    routeClient: ROUTE_CLIENT, routeClientSha256: ROUTE_SHA256,
    closingListingReconciled: true, closingOwnDetailsReconciled: true,
    nativeDetailDenials: openingDetails.failures, heldNativeIndiaInstances,
    completeCompanyInventory: false, completeWorksiteCountryInventory: false,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  } })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: JOBS, firstParty: true,
    listingComplete: false, pagesFetched: 2, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: new Date().toISOString(), reason: 'current-native-flight-instances-and-full-own-details-reconciled;whole-company-and-other-hiring-surfaces-unverified' })
}
