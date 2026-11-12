import { disposeResponseBody } from '../../scraper-support/shared/responseBodyDisposal.js'
import { createHash } from 'node:crypto'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import { selectReviewedCandidateClient } from '../darwinbox/reviewedCandidateClient.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const canonical = value => JSON.stringify(value, (_, row) => row && !Array.isArray(row) && typeof row === 'object'
  ? Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])) : row)
const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export function normalizeReviewedCorporateHtml(html, profile) {
  if (profile !== 'keyence-akamai-rum-v1') return html
  const document = readNativeDocument(html)
  for (const node of document.nodes(n => n.tag === 'script' && !n.attrs.src)) {
    const raw = node.raw || ''
    if (!raw.startsWith('!function(e){var n="https://s.go-mpulse.net/boomerang/";') || !raw.includes('BOOMR.plugins.AK={akVars:i,akDNSPreFetchDomain:a')) continue
    // Only observed per-request Akamai RUM constants vary. Keep all executable
    // statements and other literals, attributes, links and forms byte-exact.
    const reviewed = raw.replace(/a="[a-z0-9-]+-clientnsv4-s\.akamaihd\.net"/g, 'a="REVIEWED-RUM.akamaihd.net"')
      .replace(/("ak\.(?:cr|cport)":)\d+/g, '$10')
      .replace(/("ak\.rid":)"[a-f0-9]+"/g, '$1"REQUEST-ID"')
      .replace(/("ak\.gh":)"(?:\d{1,3}\.){3}\d{1,3}"/g, '$1"EDGE-ADDRESS"')
      .replace(/("ak\.t":)"\d+"/g, '$1"REQUEST-TIME"')
      .replace(/("ak\.ak":)"[A-Za-z0-9+/=]+"/g, '$1"RUM-TOKEN"')
    html = html.replace(raw, reviewed)
  }
  return html.replace(/(src="\/js\/common\/(?:basic|suz-accessLog)\.js\?var=)\d{14}("\s)/g, '$1CONTENT-PINNED$2')
}

// Both sources currently expose the same public legacy GET contract in their
// published candidate client. HTTP identity and raw scope are checked before
// adapting that envelope to the existing strict Darwinbox pagination engine.
export async function runReviewedDarwinboxInventory(spec, options = {}) {
  const { signal, fetchImpl = fetch, onAudit } = options, receipts = [], reasons = new Set()
  const fail = (condition, reason) => { if (!condition) throw new Error(`[${spec.source}] native Darwinbox: ${reason}`) }
  signal?.throwIfAborted()
  fail(!options.fetchText && !options.fetchPage && !options.fetchJson, 'native HTTP metadata required; body-only overrides unsupported')
  fail(options.maxJobs == null && options.maxPages == null, 'inventory caps unsupported')
  const origin = spec.origin, seed = origin + '/ms/candidatev2/main/careers/allJobs', api = origin + '/ms/candidateapi/'
  const checkedAt = new Date(options.now ? options.now() : Date.now()).toISOString()
  async function request(url, init = {}, cancel = false) {
    signal?.throwIfAborted()
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)
    const response = await fetchImpl(url, { ...init, method: init.method || 'GET', redirect: 'manual', signal: deadline })
    signal?.throwIfAborted()
    fail(response.url === url, 'HTTP response URL changed: ' + url)
    const receipt = { url, method: init.method || 'GET', status: response.status, responseUrl: response.url }
    receipts.push(receipt)
    if (cancel) { await disposeResponseBody(response, { signal }); signal?.throwIfAborted(); receipt.bodyConsumed = false; return { response } }
    const body = await response.text(); deadline.throwIfAborted()
    fail(Buffer.byteLength(body) <= 4000000, 'response budget exceeded')
    Object.assign(receipt, { bytes: Buffer.byteLength(body), sha256: hash(body) })
    return { response, body }
  }
  function fields(value, path, schema, context) {
    let unknown = false
    if (Array.isArray(value)) { for (const row of value) unknown = fields(row, path + '[]', schema, context) || unknown; return unknown }
    if (!value || typeof value !== 'object') return false
    const allowed = schema[path]
    if (!allowed || Object.keys(value).some(key => !allowed.includes(key))) {
      reasons.add('unreviewed-' + context + '-schema:' + path); unknown = true
    }
    for (const [key, row] of Object.entries(value)) unknown = fields(row, path + '.' + key, schema, context) || unknown
    return unknown
  }
  async function corporate() {
    const states = [], ids = new Set(), verifiedClients = new Map(); let bound = false
    // These URLs were followed from the current first-party careers graph;
    // they are fixed review inputs, never guessed employer tenant names.
    for (let i = 0; i < spec.review.corporatePages.length; i += 4) {
      const batch = await Promise.all(spec.review.corporatePages.slice(i, i + 4).map(async page => {
        const { response, body } = await request(page.url, { headers: { 'User-Agent': USER_AGENT } })
        fail(response.status === page.status, 'current corporate route status changed')
        if (spec.review.corporateNormalization === 'keyence-akamai-rum-v1') {
          const document = readNativeDocument(body)
          for (const node of document.nodes(n => n.tag === 'script' && /^\/js\/common\/(?:basic|suz-accessLog)\.js\?var=\d{14}$/.test(n.attrs.src || ''))) {
            const url = new URL(node.attrs.src, page.url).href
            if (!verifiedClients.has(url)) verifiedClients.set(url, (async () => {
              const script = await request(url, { headers: { 'User-Agent': USER_AGENT } })
              if (script.response.status !== 200 || hash(script.body) !== spec.review.corporateClientHashes[new URL(url).pathname]) reasons.add('unreviewed-corporate-common-client')
            })())
            await verifiedClients.get(url)
          }
        }
        const reviewedBody = normalizeReviewedCorporateHtml(body, spec.review.corporateNormalization)
        if (hash(reviewedBody) !== (page.reviewedSha256 || page.sha256)) reasons.add('unreviewed-corporate-content-or-executable-surface')
        if (response.status === 200) {
          const doc = readVisibleNativeDocument(body)
          for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href)) {
            let url; try { url = new URL(node.attrs.href, page.url) } catch { continue }
            if (url.origin === origin && /^\/ms\/candidatev2\/main\/careers\/allJobs$/.test(url.pathname) && !url.search && !url.hash) bound = true
            const role = url.origin === origin && url.pathname.match(/^\/ms\/candidatev2\/main\/careers\/jobDetails\/([a-z0-9]+)$/)
            if (role) { ids.add(role[1]); bound = true }
          }
        }
        return { url: page.url, status: response.status, sha256: hash(reviewedBody), responseSha256: hash(body) }
      }))
      states.push(...batch)
    }
    fail(bound, 'current active first-party native handoff missing')
    return { states, ids: [...ids].sort(), signature: hash(states.map(({responseSha256, ...state}) => state)) }
  }
  async function client() {
    const { response, body } = await request(spec.handoff, { headers: { 'User-Agent': CHROME, Accept: 'text/html' } })
    fail(response.status === 200 && /^text\/html\b/i.test(response.headers.get('content-type') || ''), 'current candidate renderer unavailable')
    const doc = readNativeDocument(body), bases = doc.nodes(n => n.tag === 'base' && n.attrs.href)
    fail(bases.length === 1, 'candidate base identity missing')
    const base = new URL(bases[0].attrs.href, spec.handoff)
    fail(base.href === origin + '/ms/candidatev2/', 'candidate base identity changed')
    const scripts = doc.nodes(n => n.tag === 'script' && n.attrs.src).map(n => new URL(n.attrs.src, base).href)
    const release = selectReviewedCandidateClient(spec, scripts)
    fail(release, 'active candidate client changed')
    const shellSignature = hash(body)
    if (shellSignature !== release.rendererSha256) reasons.add('unreviewed-native-candidate-shell')
    const visible = readVisibleNativeDocument(body), root = visible.nodes(n => n.tag === 'root')[0]
    const scope = {
      // The complete byte pin includes all active text, attributes, inline and
      // external executables, forms, frames and additional hiring channels.
      shellSignature, visibleTextSha256: hash(root ? visible.text(root) : ''),
      activeAttributesSha256: hash(doc.nodes(n => Object.keys(n.attrs).length > 0).map(n => ({ tag: n.tag, attrs: n.attrs }))),
      scripts, forms: doc.nodes(n => n.tag === 'form').map(n => n.attrs),
      frames: doc.nodes(n => n.tag === 'iframe').map(n => n.attrs),
      links: visible.nodes(n => n.tag === 'a' && n.attrs.href).map(n => ({ href: n.attrs.href, text: visible.text(n) })),
    }
    const script = await request(release.clientUrl, { headers: { 'User-Agent': CHROME, Referer: spec.handoff } })
    fail(script.response.status === 200 && hash(script.body) === release.clientSha256, 'reviewed public API client changed')
    return scope
  }
  async function json(path) {
    // A separate fresh public session is released immediately before each API
    // request. Cookies stay in memory and never enter receipts or output jobs.
    for (let attempt = 1; attempt <= 2; attempt++) {
    const session = await request(seed, {}, true)
    fail(session.response.status === 200, 'public session seed unavailable')
    const cookies = session.response.headers.getSetCookie?.().map(value => value.split(';')[0]).filter(Boolean).join('; ')
    fail(Boolean(cookies), 'public anonymous session unavailable')
    const { response, body } = await request(api + path, { headers: { 'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8', 'Content-Type': 'application/json', Cookie: cookies, Origin: origin, Referer: seed } })
    // Match the existing Darwinbox engine's bounded anonymous-session refresh.
    // Repeat the identical public read once; persistent denials fail closed.
    if (response.status === 403 && attempt === 1) continue
    fail(response.status === 200 && /^application\/json\b/i.test(response.headers.get('content-type') || ''), 'native API HTTP status/content type changed: ' + path)
    let payload; try { payload = JSON.parse(body) } catch { fail(false, 'invalid native JSON') }
    fail(payload && payload.status === 'success' && !['error', 'errors', 'errorCode', 'exception', 'fault'].some(key => Object.hasOwn(payload, key)), 'native failure envelope')
    return payload
    }
  }
  async function snapshot() {
    const companyPayload = await json('getCompanyConfig?is_preview=false&companyId=main'), company = companyPayload.message?.company
    let globalCriteriaUnknown = fields(companyPayload, '$', spec.review.schemas.company, 'company')
    fail(company && company.company_name === spec.brand && company.subdomain === spec.tenant && company.tenant_id === spec.tenantId
      && company.recruitment_enabled === true && company.new_careers === true && company.is_preview === false && company.id === '', 'native employer/account/main-board identity changed')
    if (company.group_company_site || company.custom_weblink) reasons.add('additional-native-recruiting-channel-unresolved')
    const group = await json('groupcompanycareersetting?companyId=main')
    globalCriteriaUnknown = fields(group, '$', spec.review.schemas.groups, 'group') || globalCriteriaUnknown
    fail(group.message?.code === 0, 'additional native company boards unresolved')
    const rows = [], details = [], detailPayloads = [], unreviewedRoleIds = new Set(), seen = new Set(); let total
    for (let page = 1; page <= 500; page++) {
      const payload = await json(`job?page=${page}&companyId=main`)
      fields(payload, '$', spec.review.schemas.listing, 'listing')
      if (payload.message && typeof payload.message === 'object') globalCriteriaUnknown = fields({ ...payload,
        message: { ...payload.message, jobs: [] } }, '$', spec.review.schemas.listing, 'listing') || globalCriteriaUnknown
      const count = payload.message?.jobscount, records = payload.message?.jobs
      fail(Number.isSafeInteger(count) && count >= 0 && Array.isArray(records), 'invalid authoritative native total')
      if (total == null) total = count
      fail(count === total && records.length === Math.min(10, total - rows.length), 'native pagination incomplete or count changed')
      for (const row of records) {
        fail(typeof row.id === 'string' && /^[a-z0-9]+$/.test(row.id) && typeof row.title === 'string' && row.title.trim() && !seen.has(row.id), 'native listing role identity missing or repeated')
        seen.add(row.id); rows.push(row)
        if (fields(row, '$.message.jobs[]', spec.review.schemas.listing, 'listing')) unreviewedRoleIds.add(row.id)
      }
      if (rows.length === total) break
      fail(page < 500, 'native inventory safety limit reached')
    }
    fail(total === company.allJobsCount && rows.length === total, 'company scope and complete posting inventory disagree')
    for (const row of rows) {
      const payload = await json(`job/${row.id}?companyId=main`)
      const unknownDetail = fields(payload, '$', spec.review.schemas.detail, 'detail')
      fail(Array.isArray(payload.message?.job) && payload.message.job.length === 1, 'exact native role detail missing')
      const detail = payload.message.job[0]
      fail(detail.id === row.id && clean(detail.title) === clean(row.title), 'native detail ID/title changed')
      details.push(detail)
      detailPayloads.push(payload)
      if (unknownDetail) unreviewedRoleIds.add(row.id)
    }
    return { companyPayload, group, rows, details, detailPayloads, unreviewedRoleIds: [...unreviewedRoleIds], globalCriteriaUnknown,
      total, signature: hash(canonical({ companyPayload, group, rows, detailPayloads })) }
  }
  const openingCorporate = await corporate(), openingClient = await client()
  const opening = await snapshot(), closing = await snapshot(), closingClient = await client(), closingCorporate = await corporate()
  if (opening.signature !== closing.signature) reasons.add('closing-native-inventory-or-full-details-changed')
  if (openingCorporate.signature !== closingCorporate.signature) reasons.add('closing-first-party-scope-changed')
  if (canonical(openingClient) !== canonical(closingClient)) reasons.add('closing-native-candidate-shell-changed')
  for (const id of [...openingCorporate.ids, ...closingCorporate.ids]) if (!closing.rows.some(row => row.id === id)) reasons.add('advertised-role-not-in-native-inventory')
  const mapped = []
  for (const detail of closing.details) {
    if (!opening.details.some(row => row.id === detail.id && canonical(row) === canonical(detail))) continue
    const listing = closing.rows.find(row => row.id === detail.id)
    const arrays = ['officelocations_area', 'officelocations_without_area', 'tool_tip_locations']
    const allLocations = arrays.flatMap(key => Array.isArray(detail[key]) ? detail[key] : [])
    const locationKey = value => clean(value).replace(/\s*,\s*/g, ', ').toLowerCase()
    const sameLocations = (left, right) => Array.isArray(left) && Array.isArray(right)
      && canonical(left.map(locationKey).sort()) === canonical(right.map(locationKey).sort())
    const areas = detail.officelocations_area, locationIds = detail.officelocation_arr
    const idsResolved = Array.isArray(locationIds) && Array.isArray(areas) && locationIds.length === areas.length
      && locationIds.length > 0 && locationIds.every(value => typeof value === 'string' && /^[a-z0-9]+$/.test(value))
      && new Set(locationIds).size === locationIds.length
    const displayMatches = value => typeof value === 'string' && (locationKey(value) === 'multiple locations'
      ? idsResolved && areas.length > 1 : areas?.some(area => locationKey(area) === locationKey(value)))
    const suppliedGeographyMatches = (record, isListing) => {
      for (const key of ['locations', 'officelocation_show_arr']) if (Object.hasOwn(record, key) && !displayMatches(record[key])) return false
      if (Object.hasOwn(record, 'country') && record.country !== 'India') return false
      for (const key of ['officelocations_area', 'tool_tip_locations']) if (Object.hasOwn(record, key) && !sameLocations(record[key], areas)) return false
      if (Object.hasOwn(record, 'officelocations_without_area')) {
        const values = record.officelocations_without_area
        if (!Array.isArray(values) || values.length !== areas?.length || values.some(value => typeof value !== 'string'
          || !/\bIndia\s*$/i.test(clean(value)) || !areas.some(area => locationKey(area) === locationKey(value)
            || locationKey(area).endsWith(', ' + locationKey(value))))) return false
      }
      if (Object.hasOwn(record, 'officelocation_show_arr_list')) {
        const values = record.officelocation_show_arr_list
        if (!Array.isArray(values) || !(values.length === 1 && /^multiple locations$/i.test(clean(values[0]))
          ? displayMatches(values[0]) : sameLocations(values, areas))) return false
      }
      // The legacy GET listing supplies exactly an empty-string ID placeholder;
      // it asserts no additional locations. Any supplied IDs must reconcile.
      if (Object.hasOwn(record, 'officelocation_arr') && !(isListing && record.officelocation_arr === '')
        && (!Array.isArray(record.officelocation_arr) || !idsResolved
          || canonical([...record.officelocation_arr].sort()) !== canonical([...locationIds].sort()))) return false
      return true
    }
    if (arrays.some(key => !Array.isArray(detail[key]) || !detail[key].length) || allLocations.some(value => typeof value !== 'string' || !/\bIndia\s*$/i.test(clean(value)))
      || !sameLocations(detail.officelocations_area, detail.tool_tip_locations)
      || !sameLocations(listing.tool_tip_locations, detail.tool_tip_locations)
      || !idsResolved || !suppliedGeographyMatches(detail, false) || !suppliedGeographyMatches(listing, true)) {
      reasons.add('native-role-country-alternatives-unresolved:' + detail.id); continue
    }
    if (detail.country != null && detail.country !== 'India') { reasons.add('contradictory-native-country:' + detail.id); continue }
    const html = decodeNativeEntities(detail.jd), description = extractActiveDescription(html)
    if (!description || !hasSourceDescription({ sourceDescription: description })) { reasons.add('native-full-criteria-unavailable:' + detail.id); continue }
    const visibilityUnknown = /<(?:script|style|template)\b|\b(?:hidden|inert|aria-hidden)\b|display\s*:\s*none|visibility\s*:\s*hidden/i.test(html)
    if (visibilityUnknown) reasons.add('native-description-visibility-unreviewed:' + detail.id)
    const criteriaUnknown = opening.globalCriteriaUnknown || closing.globalCriteriaUnknown
      || opening.unreviewedRoleIds.includes(detail.id) || closing.unreviewedRoleIds.includes(detail.id)
    const detailComplete = !criteriaUnknown && !visibilityUnknown
    const published = detail.job_posting?.careers?.from
    fail(Number.isSafeInteger(published) && published > 0 && published === detail.posted_on && published * 1000 <= Date.parse(checkedAt), 'native original publication timestamp missing or conflicting')
    const locations = [...new Set(detail.officelocations_area.map(value => clean(value).replace(/\s*,\s*/g, ', '))) ]
    mapped.push({ ...detail, locations: locations.join(' / '), country: 'India', department_name: detail.department, emp_type_name: detail.emp_type,
      jd: description, detailComplete,
      postingDate: new Date(published * 1000).toISOString(), nativeLocationAlternatives: locations, nativeRaw: detail })
  }
  // Keep the established envelope, pagination and native date/content mapper.
  // Every adapted field above originates in this role's checked native detail.
  const shared = await createDarwinboxScraper({ source: spec.source, companyName: spec.company, origin, pageSize: 10 }).run({ signal,
    maxPages: Math.max(1, Math.ceil(mapped.length / 10)), maxJobs: null,
    fetchListingPage: async ({ page }) => ({ status: 'success', data: mapped.slice((page - 1) * 10, page * 10), job_counts: mapped.length }),
    fetchJobDetail: async ({ jobId }) => closing.detailPayloads.find(payload => payload.message.job[0].id === jobId) })
  fail(readInventoryEvidence(shared)?.listingComplete === true, 'shared native mapper did not exhaust verified role inventory')
  const complete = reasons.size === 0 && mapped.length === closing.total
  const jobs = shared.map(job => { const native = mapped.find(row => row.id === job.jobId); return { ...job, country: 'India', city: null,
    atsPlatform: 'darwinbox', companyCareerPage: spec.review.corporatePages[0].url,
    companyDomain: new URL(spec.review.corporatePages[0].url).hostname.replace(/^www\./, ''),
    postingDate: native.postingDate, sourcePostingDate: native.postingDate, sourceDetailComplete: native.detailComplete,
    ...(!native.detailComplete ? { sourceDetailFailureKind: 'native-criteria-schema-or-visibility-unreviewed' } : {}),
    sourceDescription: native.jd, jobDescription: native.jd, sourceNativeJob: native.nativeRaw,
    sourceNativeListingRecord: closing.rows.find(row => row.id === job.jobId),
    sourceNativeDetailPayload: closing.detailPayloads.find(payload => payload.message.job[0].id === job.jobId),
    sourceNativeLocations: native.nativeLocationAlternatives, locations: native.nativeLocationAlternatives,
    sourceNativeLocationIds: native.nativeRaw.officelocation_arr,
    requisitionId: native.internal_job_code || null, nativeEmployerBrand: spec.brand,
    sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete } })
  const audit = { source: spec.source, productionWrites: false, complete, reasons: [...reasons], nativeTotal: closing.total,
    returnedIndiaJobs: jobs.length, openingSignature: opening.signature, closingSignature: closing.signature,
    openingCorporate, closingCorporate, openingClient, closingClient, nativeIds: closing.rows.map(row => row.id), receipts }
  onAudit?.(structuredClone(audit)); signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: complete ? jobs.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
    surface: seed, firstParty: true, listingComplete: complete, pagesFetched: receipts.length,
    reportedTotal: complete ? closing.total : null, indiaFacetCount: complete ? jobs.length : null, verifiedAt: checkedAt,
    reason: complete ? 'current-employer-group-complete-native-get-inventory-full-detail-country-and-closing-proof'
      : 'darwinbox-source-partial:' + [...reasons].join(';') })
}
