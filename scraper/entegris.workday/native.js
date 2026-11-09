import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { normalizeNativeAttributeBoundaries } from '../../scraper-support/utils/nativeHtmlAttributes.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'

export const CAREERS = 'https://www.entegris.com/careers'
export const HANDOFF = 'https://www.entegris.com/en/home/about-us/careers/job-opportunities.html'
export const BASE = 'https://entegris.wd1.myworkdayjobs.com/EntegrisCareers'
export const API = 'https://entegris.wd1.myworkdayjobs.com/wday/cxs/entegris/EntegrisCareers/jobs'
const INDIA = 'c4f78be1a8f14da0ab49ce1162348a5e'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const requireNative = (condition, reason) => { if (!condition) throw Error('Entegris: ' + reason) }
const hasBase = node => node.tag !== 'template' && (node.tag === 'base'
  || node.children.some(child => typeof child !== 'string' && hasBase(child)))

async function selectedIndiaScope(signal) {
  const response = await fetch(API, { method: 'POST', redirect: 'error', credentials: 'omit',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ appliedFacets: { locationCountry: [INDIA] }, limit: 20, offset: 0, searchText: '' }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) })
  requireNative(response.status === 200 && response.url === API, 'native scope HTTP ' + response.status)
  requireNative(response.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'native scope MIME changed')
  const reader = response.body?.getReader(), chunks = []
  requireNative(reader, 'native scope body unavailable')
  let bytes = 0
  try {
    for (;;) {
      const part = await reader.read()
      signal.throwIfAborted()
      if (part.done) break
      bytes += part.value.byteLength
      requireNative(bytes <= 1024 * 1024, 'native scope byte limit')
      chunks.push(Buffer.from(part.value))
    }
  } catch (error) { await reader.cancel(error).catch(() => {}); throw error }
  finally { reader.releaseLock() }
  const body = Buffer.concat(chunks, bytes), payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
  requireNative(payload && payload.success !== false && !payload.error && !(payload.errors?.length)
    && Number.isSafeInteger(payload.total) && payload.total >= 0 && Array.isArray(payload.jobPostings)
    && payload.jobPostings.length === Math.min(20, payload.total), 'invalid native scope inventory')
  const countries = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.facetParameter === 'locationCountry' && Array.isArray(value.values)) countries.push(...value.values)
    Object.values(value).forEach(visit)
  }
  visit(payload.facets)
  const india = countries.filter(value => value.descriptor === 'India')
  requireNative(india.length === 1 && india[0].id === INDIA
    && (india[0].count == null || india[0].count === payload.total), 'native India country facet unavailable or contradictory')
  return { total: payload.total, countryId: india[0].id, nativeDescriptor: india[0].descriptor,
    bodySHA256: createHash('sha256').update(body).digest('hex'), checkedAt: new Date().toISOString() }
}

export async function runNativeEntegris(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(300000)])
  signal.throwIfAborted()
  const read = createHTMLTransport({ validateURL: url => requireNative([CAREERS, HANDOFF].includes(url), 'unadvertised public handoff URL') }, { signal })
  const corporate = await read(CAREERS)
  requireNative(corporate.status === 200 && corporate.headers['content-type']?.split(';')[0].trim() === 'text/html', 'careers HTTP ' + corporate.status)
  const html = normalizeNativeAttributeBoundaries(new TextDecoder('utf-8', { fatal: true }).decode(corporate.body))
  requireNative(!hasBase(document(html).root), 'unreviewed corporate document base')
  const doc = readVisibleNativeDocument(html)
  requireNative(doc.nodes(node => {
    if (node.tag !== 'a' || typeof node.attrs.href !== 'string') return false
    try { return new URL(node.attrs.href, CAREERS).href === HANDOFF } catch { return false }
  }).length > 0, 'current official Job Opportunities handoff missing')
  const handoff = await read(HANDOFF)
  requireNative([301, 302, 303, 307, 308].includes(handoff.status)
    && typeof handoff.headers.location === 'string' && new URL(handoff.headers.location, HANDOFF).href === BASE,
  'current corporate redirect no longer binds the native board')
  const scope = await selectedIndiaScope(signal)
  const jobs = await runVerifiedWorkdayBoardUnion({ source: 'entegris', company: 'Entegris',
    boards: [{ tenant: 'entegris', site: 'EntegrisCareers', baseUrl: BASE, scraperDir: currentDir }],
    employerPattern: /\bentegris\b/i, requireEmployer: true, completeSourceScope: false,
    scopeReason: 'current-official-redirect-bound-native-India-facet;other-company-recruitment-channels-unverified',
  }, { ...options, signal, nativeDetailRecovery: false, retainNativeProof: true })
  signal.throwIfAborted()
  const proof = jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  requireNative(proof?.boards?.length === 1 && proof.boards[0].reportedTotal === scope.total, 'native India scope changed during collection')
  proof.currentOfficialBinding = { careersURL: CAREERS, handoffURL: HANDOFF, currentRedirectTarget: BASE, nativeIndiaScope: scope }
  const finalCorporate=await read(CAREERS)
  requireNative(finalCorporate.status===200&&finalCorporate.headers['content-type']?.split(';')[0].trim()==='text/html'
    && readVisibleNativeDocument(normalizeNativeAttributeBoundaries(new TextDecoder('utf-8',{fatal:true}).decode(finalCorporate.body)))
      .nodes(node=>node.tag==='a'&&typeof node.attrs.href==='string'&&new URL(node.attrs.href,CAREERS).href===HANDOFF).length>0,
    'closing current corporate handoff unavailable')
  const finalHandoff=await read(HANDOFF)
  requireNative([301,302,303,307,308].includes(finalHandoff.status)
    &&new URL(finalHandoff.headers.location,HANDOFF).href===BASE,'closing corporate redirect changed')
  for (const job of jobs) Object.assign(job, {
    sourceOfficialBinding:{careersURL:CAREERS,handoffURL:HANDOFF,boardURL:BASE,
      openingBodySHA256:createHash('sha256').update(corporate.body).digest('hex'),
      closingBodySHA256:createHash('sha256').update(finalCorporate.body).digest('hex'),
      nativeIndiaScope:scope,currentHandoffRechecked:true,checkedAt:new Date().toISOString(),companyScopeComplete:false},
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
  return jobs
}
