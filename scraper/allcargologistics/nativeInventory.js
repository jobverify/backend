import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import { createHash } from 'node:crypto'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeHead, activeIframeSources, readNativeDocument, activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'

const OFFICIAL = 'https://www.allcargologistics.com/about-us/careers'
const ORIGIN = 'https://allcargologistics.darwinbox.in'
const HOME = ORIGIN + '/ms/candidatev2/main/careers/home'
const SEED = ORIGIN + '/ms/candidatev2/main/careers/allJobs'
export const CURRENT_LISTING_API_URL = ORIGIN + '/ms/candidateapi/job/alljobs?companyId=main'
const BRAND = 'Allcargo Logistics Ltd.'
const sha = value => createHash('sha256').update(value).digest('hex')
const requireNative = (condition, message) => { if (!condition) { const error = new Error('Allcargo native inventory: ' + message); error.abortRetries = true; error.failureKind = 'parser_or_contract_error'; throw error } }
const nativeUrl = (value, base) => { try { return new URL(value, base).href } catch { return null } }
const brandName = value => typeof value === 'string' && value.trim() === BRAND
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value
const key = value => JSON.stringify(stable(value))
const recruitingDomains = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com', 'workdayjobs.com',
  'smartrecruiters.com', 'workable.com', 'icims.com', 'successfactors.com', 'successfactors.eu', 'taleo.net',
  'jobs2web.com', 'teamtailor.com', 'personio.com', 'personio.de', 'bamboohr.com', 'freshteam.com',
  'applytojob.com', 'breezy.hr', 'recruitee.com', 'jobvite.com', 'darwinbox.in', 'darwinbox.com', 'keka.com']
const knownRecruitingUrl = value => {
  try {
    const host = new URL(value).hostname
    return recruitingDomains.some(domain => host === domain || host.endsWith('.' + domain))
  } catch { return false }
}
const structuredJobPosting = script => {
  const walk = node => Array.isArray(node) ? node.some(walk) : node && typeof node === 'object'
    ? [node['@type']].flat().some(type => typeof type === 'string' && /^(?:(?:https?:\/\/)?schema\.org\/)?JobPosting$/.test(type)) || Object.values(node).some(walk)
    : false
  try { return walk(JSON.parse(script)) } catch {
    // Ambiguous structured role declarations cannot prove inventory absence.
    return /["']@type["']\s*:\s*(?:["']JobPosting["']|\[[^\]]*["'](?:https?:\/\/schema\.org\/)?JobPosting["'])/i.test(script)
  }
}

function inspectSurface(body, url, official) {
  const doc = readNativeDocument(body), head = activeHead(body)
  requireNative(head.titles.length === 1 && (official ? /allcargo/i.test(head.titles[0]) && /career/i.test(head.titles[0]) : brandName(head.titles[0])), 'employer title identity changed')
  if (!official) {
    const identities = head.metas.filter(meta => ['og:title', 'twitter:title'].includes(meta.property || meta.name))
    requireNative(identities.some(meta => brandName(meta.content)) && identities.every(meta => brandName(meta.content)), 'native company identity missing or conflicting')
  }
  const links = doc.nodes(n => n.tag === 'a' && n.attrs.href).map(n => ({ url: nativeUrl(n.attrs.href, url), text: doc.text(n) }))
  if (official) requireNative(links.some(link => link.url === HOME), 'current active first-party Darwinbox handoff missing')
  const extra = links.filter(link => link.url && ![OFFICIAL, OFFICIAL + '/', HOME, SEED].includes(link.url.split('#')[0])
    && (knownRecruitingUrl(link.url) || /career|jobs?|recruit|vacanc|fellowship|internship|appl(?:y|ication)|join.*team|opportunit/i.test(link.url + ' ' + link.text))).map(link => link.url)
  extra.push(...activeIframeSources(body).map(value => nativeUrl(value, url)).filter(Boolean))
  if (activeScripts(body).some(structuredJobPosting)) extra.push('unreconciled-structured-job-posting')
  return [...new Set(extra)].sort()
}

function inspectPayload(payload) {
  requireNative(payload && typeof payload === 'object' && !Array.isArray(payload) && payload.status === 'success' && Array.isArray(payload.data), 'failed or malformed native listing envelope')
  const reviewed = new Set(['status', 'data', 'job_counts', 'companyId', 'company_id', 'companyName', 'company_name', 'next', 'next_page', 'nextPage', 'has_more', 'hasMore', 'total_pages'])
  requireNative(Object.keys(payload).every(field => reviewed.has(field)), 'unreviewed native envelope scope or pagination')
  const total = payload.job_counts
  requireNative(total == null || typeof total === 'number' && Number.isSafeInteger(total) && total >= 0, 'invalid explicit native total')
  requireNative(total == null || payload.data.length <= total, 'native count contradicts records')
  requireNative(!(payload.data.length === 0 && total > 0), 'truncated native listing')
  for (const field of ['next', 'next_page', 'nextPage', 'has_more', 'hasMore']) requireNative(payload[field] == null || payload[field] === false || payload[field] === 0 || payload[field] === '', 'unreviewed native pagination')
  if (payload.total_pages != null) requireNative(Number.isSafeInteger(payload.total_pages) && payload.total_pages <= 1, 'unreviewed native page count')
  for (const field of ['companyId', 'company_id']) requireNative(payload[field] == null || payload[field] === 'main', 'foreign native company identity')
  for (const field of ['companyName', 'company_name']) requireNative(payload[field] == null || brandName(payload[field]), 'foreign native employer identity')
  return total ?? null
}

// Positive inventories stay unresolved until exact criteria and native geography
// are supported. No generic city/HQ fallback can establish empty inventory.
export async function runCurrentAllcargoInventory({ fetchImpl = fetch, signal, onAudit, now = () => new Date().toISOString() } = {}) {
  signal?.throwIfAborted()
  const receipts = []
  async function request(url, init = {}, releaseSession = false) {
    signal?.throwIfAborted()
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)
    const response = await fetchImpl(url, { ...init, method: init.method || 'GET', redirect: 'manual', signal: requestSignal })
    signal?.throwIfAborted()
    requireNative(response?.url === url, 'public response URL changed at ' + url)
    requireNative(Number.isInteger(response.status) && response.status >= 100 && response.status <= 599, 'invalid public HTTP status at ' + url)
    if (response.status !== 200) {
      const denied = [401, 403, 429, 451].includes(response.status)
      const retryable = response.status === 408 || response.status >= 500
      receipts.push({ url, status: response.status, responseUrl: response.url, bodyConsumed: false })
      // A failed public session is not an empty listing or a parser defect.
      // A transient retry must restart the collector and obtain a fresh session.
      try { Promise.resolve(response.body?.cancel()).catch(() => {}) } catch { /* Preserve the original HTTP failure. */ }
      throw Object.assign(new Error('Allcargo native inventory: public HTTP ' + response.status + ' at ' + url), {
        code: 'ALLCARGO_NATIVE_HTTP', status: response.status, abortRetries: !retryable,
        failureKind: denied ? 'public_access_denied' : 'network_or_timeout',
        ...(denied ? { softFailure: true, upstreamOutage: true } : {}),
        retainedNativeResponses: receipts,
        inventoryEvidence: { status: 'coverage-gap', surface: OFFICIAL, firstParty: receipts.some(receipt => receipt.url === OFFICIAL && receipt.status === 200),
          listingComplete: false, pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null },
      })
    }
    if (releaseSession) {
      try { await disposeResponseBody(response, {signal: requestSignal}) }
      catch (error) { signal?.throwIfAborted(); throw error }
      signal?.throwIfAborted()
      receipts.push({ url, status: response.status, responseUrl: response.url, bodyConsumed: false, purpose: 'public-session-seed' })
      return { response }
    }
    const body = await response.text()
    signal?.throwIfAborted()
    requireNative(Buffer.byteLength(body) <= 4000000, 'response budget exceeded')
    receipts.push({ url, status: response.status, responseUrl: response.url, bytes: Buffer.byteLength(body), sha256: sha(body) })
    return { body, response }
  }
  async function surface(url, official) {
    const { body } = await request(url)
    return { hash: sha(body), additional: inspectSurface(body, url, official) }
  }
  async function inventory() {
    const seeded = await request(SEED)
    const additional = inspectSurface(seeded.body, SEED, false)
    // Session cookies stay in memory; audits never contain request headers or
    // Set-Cookie values. This is the public candidate session only.
    // The public endpoint accepts its fresh session when the seed response is
    // released immediately. Inspect employer identity separately above; do not
    // consume or clone this second seed body before the listing request.
    const session = await request(SEED, {}, true)
    const cookies = session.response.headers?.getSetCookie?.().map(value => value.split(';')[0]).filter(Boolean).join('; ')
    requireNative(Boolean(cookies), 'public candidate session unavailable')
    const { body, response } = await request(CURRENT_LISTING_API_URL, {
      method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', 'Content-Type': 'application/json', Cookie: cookies, Origin: ORIGIN, Referer: SEED },
      body: JSON.stringify({ companyId: 'main', sort_option: 'new', limit: 10, page: 1 }),
    })
    requireNative(/^application\/json\b/i.test(response.headers?.get?.('content-type') || ''), 'native API content type changed')
    let payload; try { payload = JSON.parse(body) } catch { requireNative(false, 'native JSON malformed') }
    const total = inspectPayload(payload)
    return { payload, total, additional, seedHash: sha(seeded.body) }
  }
  const openingSurface = await surface(OFFICIAL, true), openingBoard = await surface(HOME, false), opening = await inventory()
  const closing = await inventory(), closingBoard = await surface(HOME, false), closingSurface = await surface(OFFICIAL, true)
  const additional = [...new Set([...openingSurface.additional, ...closingSurface.additional, ...openingBoard.additional, ...closingBoard.additional, ...opening.additional, ...closing.additional])]
  const reasons = []
  if (additional.length) reasons.push('additional-hiring-scope-unresolved')
  if (key(opening.payload) !== key(closing.payload)) reasons.push('closing-native-inventory-changed')
  if (openingSurface.hash !== closingSurface.hash || openingBoard.hash !== closingBoard.hash || opening.seedHash !== closing.seedHash) reasons.push('closing-employer-binding-changed')
  if (opening.total == null || closing.total == null) reasons.push('native-total-unknown')
  if (opening.payload.data.length || closing.payload.data.length) reasons.push('nonempty-native-details-and-country-unresolved')
  // Keep the existing Darwinbox envelope/pagination guard, rather than letting
  // a successful HTTP response stand in for a validated native inventory.
  if (!opening.payload.data.length && !closing.payload.data.length) {
    const inner = await createDarwinboxScraper({ source: 'allcargologistics', companyName: 'Allcargo Logistics', origin: ORIGIN }).run({
      fetchListingPage: async () => opening.payload, maxPages: 1, maxJobs: null, signal,
    })
    if (!readInventoryEvidence(inner)?.listingComplete) reasons.push('native-pagination-unverified')
  }
  const complete = reasons.length === 0 && opening.total === 0 && closing.total === 0
  const observedAt = typeof now === 'function' ? now() : now
  const audit = { source: 'allcargologistics', observedAt, nativeCompanyName: BRAND, nativeTotal: opening.total, closingNativeTotal: closing.total, nativeRows: opening.payload.data.length,
    globalJobs: complete ? 0 : null, indiaJobs: complete ? 0 : null, eligibleJobs: complete ? 0 : null, fullDescriptions: complete ? 0 : null, unknownCountryJobs: complete ? 0 : null,
    complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete, additionalHiringScopes: additional, reasons, receipts, productionWrites: false, applicationsVisited: false }
  const jobs = attachInventoryEvidence([], { status: complete ? 'verified-empty' : 'discovery-only', firstParty: true, listingComplete: complete, surface: OFFICIAL,
    pagesFetched: receipts.length, reportedTotal: complete ? 0 : null, indiaFacetCount: complete ? 0 : null, verifiedAt: observedAt,
    reason: complete ? 'allcargo-current-first-party-brand-bound-empty-inventory-reconciled' : 'allcargo-native-partial:' + reasons.join(';') })
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  onAudit?.(structuredClone(audit))
  return jobs
}
