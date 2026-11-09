import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const CAREERS = 'https://hightouch.com/careers'
const TOKEN = 'hightouch-inc'
const BOARD = 'https://jobs.ashbyhq.com/' + TOKEN
const API = 'https://api.ashbyhq.com/posting-api/job-board/' + TOKEN
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/
const text = value => typeof value === 'string' && Boolean(value.trim())
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const same = (a, b) => canonical(a) === canonical(b)
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Hightouch native: ' + message), {
    code: 'HIGHTOUCH_NATIVE_CONTRACT', softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const envelope = value => {
  need(value && typeof value === 'object' && !Array.isArray(value), 'native response object missing')
  need(!value.error && !value.errors && value.success !== false, 'native upstream error response')
}
function next(body, roleId) {
  const document = readVisibleNativeDocument(body, { strict: true })
  need(!document.nodes(node => node.tag === 'base').length, 'unqualified primary page base URL')
  const scripts = document.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  need(scripts.length === 1 && scripts[0].attrs.type === 'application/json' && !scripts[0].attrs.src, 'current primary Next inventory missing/ambiguous')
  const data = JSON.parse(scripts[0].raw)
  envelope(data); envelope(data.props); envelope(data.props.pageProps)
  need(data.page === (roleId ? '/careers/[slug]' : '/careers') && data.locale === 'en' && data.isFallback === false
    && same(data.query, roleId ? { slug: roleId } : {}), 'primary Next route/role identity mismatch')
  return { document, props: data.props.pageProps }
}
function primary(body) {
  const { document, props } = next(body), rows = props.jobPostings
  need(Array.isArray(rows) && rows.length >= 1 && rows.length <= 10000, 'current primary jobPostings inventory unavailable')
  const byId = new Map()
  for (const row of rows) {
    need(uuid.test(row.id || '') && text(row.title) && text(row.departmentName) && text(row.locationName)
      && !byId.has(row.id), 'primary role summary identity missing/repeated')
    byId.set(row.id, row)
  }
  const cards = document.nodes(node => node.tag === 'a' && /^\/careers\/[a-f\d-]{36}$/.test(node.attrs.href || ''))
  const ids = [...new Set(cards.map(node => node.attrs.href.split('/').at(-1)))]
  need(ids.length === rows.length && ids.every(id => byId.has(id)), 'active primary role cards and typed inventory differ')
  for (const row of rows) need(cards.some(node => node.attrs.href === '/careers/' + row.id
    && document.text(node).includes(row.title.trim()) && document.text(node).includes(row.locationName)), 'primary rendered role summary mismatch')
  return { rows, qualifying: ids.slice(0, 2).map(id => byId.get(id)) }
}
function qualifyingRole(body, summary) {
  const { document, props } = next(body, summary.id), posting = props.posting
  envelope(posting)
  need(posting.id === summary.id && posting.title === summary.title && posting.departmentName === summary.departmentName
    && posting.locationName === summary.locationName, 'primary role summary/detail identity mismatch')
  need(posting.applyLink === BOARD + '/' + summary.id, 'primary application/native account binding changed')
  const scripts = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
  const postings = scripts.map(node => JSON.parse(node.raw)).filter(value => value?.['@type'] === 'JobPosting')
  need(postings.length === 1 && same(postings[0], posting.linkedData), 'primary posting schema and typed role identity disagree')
  const schema = postings[0], heading = document.nodes(node => node.tag === 'h1')
  need(schema.title === summary.title && schema.identifier?.name === 'Hightouch' && schema.identifier.value === summary.id
    && schema.hiringOrganization?.name === 'Hightouch' && schema.hiringOrganization.sameAs === 'https://hightouch.com/'
    && heading.length === 1 && document.text(heading[0]) === summary.title, 'primary hiring organization/employer/title identity mismatch')
  const description = extractActiveDescription(posting.descriptionHtml)
  need(description && description.length >= 100 && description === extractActiveDescription(schema.description)
    && document.nodes(node => node.tag === 'body').some(node => document.text(node).includes(description)), 'primary full rendered role description mismatch')
  return posting
}
function publication(raw, now) {
  need(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw), 'native publication date missing/malformed')
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number), date = Date.parse(raw)
  need(month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && Number.isFinite(date) && date <= Date.parse(now), 'native publication date invalid/future')
}
// Reject explicit contradictions; do not fill a missing country from a city,
// state or broad remote label. These exact India city/state pairs are also used
// by the repository's existing native geography checks.
const indiaCityStates = { mumbai: 'maharashtra', chennai: 'tamil nadu', hyderabad: 'telangana',
  bangalore: 'karnataka', bengaluru: 'karnataka', delhi: 'delhi' }
const outsideIndiaRegions = /\b(?:north america|south america|latin america|americas|europe|emea|latam|united states|united kingdom|canada|australia)\b/i
function geography(job) {
  const candidates = [{ location: job.location, address: job.address }, ...(job.secondaryLocations || [])]
  for (const candidate of candidates) {
    const address = candidate.address?.postalAddress ?? candidate.address
    const country = typeof address?.addressCountry === 'string' ? address.addressCountry.trim() : ''
    const india = /^(?:india|in|ind)$/i.test(country), label = typeof candidate.location === 'string' ? candidate.location : ''
    need(!(india && outsideIndiaRegions.test(label) && !/\bIndia\b/i.test(label)), 'explicit native India country contradicts exclusive regional geography')
    const city = typeof address?.addressLocality === 'string' ? address.addressLocality.trim().toLowerCase() : ''
    const state = typeof address?.addressRegion === 'string' ? address.addressRegion.trim().toLowerCase() : ''
    need(!(country && !india && indiaCityStates[city] && indiaCityStates[city] === state), 'explicit native foreign country contradicts known India city/state geography')
  }
}
function reconcile(primaryRows, roles, payload, now) {
  envelope(payload)
  need(payload.apiVersion === '1' && Array.isArray(payload.jobs) && payload.jobs.length <= 10000, 'native inventory schema changed')
  const byId = new Map()
  for (const job of payload.jobs) {
    need(uuid.test(job.id || '') && !byId.has(job.id) && typeof job.isListed === 'boolean', 'native inventory identity repeated or listed status missing')
    publication(job.publishedAt, now)
    geography(job)
    need(extractActiveDescription(job.descriptionHtml) && text(job.descriptionPlain), 'complete native role description/content missing')
    byId.set(job.id, job)
  }
  const listed = payload.jobs.filter(job => job.isListed)
  need(listed.length === primaryRows.length && primaryRows.every(row => {
    const native = byId.get(row.id)
    return native?.isListed === true && row.title === native.title && row.departmentName === native.department && row.locationName === native.location
  }), 'native listed inventory and primary role summaries disagree')
  for (const role of roles) {
    const native = byId.get(role.id)
    need(native?.jobUrl === role.applyLink && role.linkedData.datePosted === native.publishedAt.slice(0, 10), 'native account/role/publication identity disagrees with current primary posting')
  }
}

export async function runNativeHightouch({ signal: callerSignal, now = () => new Date().toISOString(), maxJobs = 0 } = {}) {
  need(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && maxJobs <= 10000, 'invalid output bound')
  const checkedAt = typeof now === 'function' ? now() : now
  need(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)), 'invalid check time')
  const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(180000)])
  let requests = 0, totalBytes = 0
  async function get(url, json = false) {
    signal.throwIfAborted(); need(++requests <= 30, 'native request bound exceeded')
    const response = await fetch(url, { method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      headers: { Accept: json ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
    need(response.status === 200, 'HTTP unavailable: ' + response.status)
    need(response.url === url, 'HTTP redirect identity changed')
    need((json ? /^application\/json\b/i : /^text\/html\b/i).test(response.headers.get('content-type') || ''), 'native response content type changed')
    const reader = response.body?.getReader(), chunks = []; let bytes = 0
    need(reader, 'native response body missing')
    try {
      for (;;) {
        signal.throwIfAborted()
        const { value, done } = await reader.read(); if (done) break
        bytes += value.byteLength; totalBytes += value.byteLength
        need(bytes <= 3 * 1024 * 1024 && totalBytes <= 32 * 1024 * 1024, 'native response byte bound exceeded')
        chunks.push(value)
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error }
    finally { reader.releaseLock() }
    signal.throwIfAborted(); need(bytes > 0, 'native response body empty')
    const body = Buffer.concat(chunks).toString('utf8')
    return json ? JSON.parse(body) : body
  }
  const provider = { source: 'hightouch', companyName: 'Hightouch', companyDomain: 'hightouch.com',
    companyCareerPage: CAREERS, atsPlatform: 'ashby', boardToken: TOKEN, sourceScopeComplete: false, zeroResultPolicy: 'evidence-required' }
  async function snapshot() {
    const current = primary(await get(CAREERS)), roles = []
    for (const summary of current.qualifying) roles.push(qualifyingRole(await get(CAREERS + '/' + summary.id), summary))
    const board = readVisibleNativeDocument(await get(BOARD), { strict: true }), titles = board.nodes(node => node.tag === 'title')
    need(titles.length === 1 && titles[0].raw === 'Hightouch Jobs', 'current native board employer brand changed')
    const payload = await get(API + '?includeCompensation=true', true)
    reconcile(current.rows, roles, payload, checkedAt)
    // Run established native Ashby identity, location and content checks even
    // when every selected India result is empty or geography is unresolved.
    const jobs = await createPublishingGapAtsScraper(provider).run({ signal, fetchJson: async url => {
      need(url === API, 'unexpected mapping/native account request'); return payload
    } })
    return { current, roles, payload, jobs, evidence: readInventoryEvidence(jobs) }
  }
  const initial = await snapshot(), closing = await snapshot()
  need(same({ current: initial.current, roles: initial.roles, payload: initial.payload },
    { current: closing.current, roles: closing.roles, payload: closing.payload }), 'primary/native full inventory/content/compensation changed during closing reconciliation')
  const byId = new Map(initial.payload.jobs.map(job => [job.id, job]))
  const jobs = (maxJobs ? initial.jobs.slice(0, maxJobs) : initial.jobs).map(job => {
    const native = byId.get(job.jobId)
    const compensation = native.shouldDisplayCompensationOnJobPostings === true && text(native.compensation?.compensationTierSummary)
      ? '\n\nCompensation\n' + native.compensation.compensationTierSummary : ''
    const description = native.descriptionHtml + compensation
    return { ...job, country: 'India', sourceDescription: description, jobDescription: description, sourceNativePosting: native,
      nativeCompensation: native.compensation ?? null, nativePublishedAt: native.publishedAt,
      nativeEmployerBrand: 'Hightouch', nativeLegalEmployer: null, sourceDetailComplete: true,
      sourceOfficialBinding: { officialURL: CAREERS, nativeAccount: TOKEN, qualifyingRoleIds: initial.roles.map(role => role.id) },
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: checkedAt }
  })
  signal.throwIfAborted()
  Object.defineProperty(jobs, PROOF, { value: { source: 'hightouch',
    binding: { officialURL: CAREERS, nativeAccount: TOKEN, qualifyingRoleIds: initial.roles.map(role => role.id) },
    nativeInventory: { observedNativeRoles: initial.payload.jobs.length, observedSelectedIndiaRoles: initial.jobs.length,
      snapshots: 2, unresolvedCountryScope: /location-scope-unresolved|location-unmapped/.test(initial.evidence?.reason || '') } } })
  return attachInventoryEvidence(jobs, { ...initial.evidence, status: 'coverage-gap', surface: API, firstParty: true, listingComplete: false,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: 'current-primary-Next-JobPosting-native-account-and-full-feed-closing-reconciled;whole-company-scope-unverified;' + initial.evidence?.reason })
}
