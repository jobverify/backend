import { createHash } from 'node:crypto'
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'
import { extractOfficialRecruitmentLinks } from './officialRecruitmentLinks.js'

// Exact source contracts frozen from reviewed native probes and current
// corporate handoffs, including Thryve Digital's documented enGen rebrand.
// Tenant identity is never inferred from a company name or supplied by a trial.
const contracts = [
  ['mindsprint', 'Mindsprint', 'mindsprint.darwinbox.in', 'a671608963ef6d', 'mindsprint.com'],
  ['leadsquared', 'LeadSquared', 'leadsquaredhrms.darwinbox.in', 'main', 'leadsquared.com'],
  ['rockmanindustries', 'Rockman Industries', 'rockman.darwinbox.in', 'main', 'rockman.in'],
  ['cleartax', 'ClearTax', 'clear.darwinbox.in', 'main', 'clear.in'],
  ['elgi', 'ELGi', 'elgi.darwinbox.in', 'a61e65404e890b', 'elgi.com'],
  ['cardekho', 'CarDekho', 'cardekho.darwinbox.in', '606876f7e2c79', 'cardekho.com'],
  ['bigbasket', 'BigBasket', 'bigbasket.darwinbox.in', 'main', 'bigbasket.com'],
  ['tessolve', 'Tessolve', 'tessolve.darwinbox.com', 'main', 'tessolve.com'],
  ['vivriticapital', 'Vivriti Capital', 'vivriti.darwinbox.in', 'main', 'vivriticapital.com'],
  ['unacademy', 'Unacademy', 'unacademy.darwinbox.in', 'main', 'unacademy.com'],
  ['shoppersstop', 'Shoppers Stop', 'ss-people.darwinbox.in', 'main', 'shoppersstop.com'],
  ['thryvedigital', 'Thryve Digital', 'tdh.darwinbox.in', 'main', 'goengen.in'],
]
export const DARWINBOX_PARTIAL_CONTRACTS = Object.freeze(Object.fromEntries(contracts.map(
  ([source, companyName, host, companyId, companyDomain]) => [source, Object.freeze({
    source, companyName, origin: `https://${host}`, companyId, companyDomain,
    listingUrl: `https://${host}/ms/candidateapi/job/alljobs?companyId=${companyId}`,
  })],
)))
const requireProof = (condition, message) => { if (!condition) throw new Error(message) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const fresh = (value, now) => value && Number.isFinite(Date.parse(value))
  && Date.parse(value) <= +now && +now - Date.parse(value) <= 48 * 3600000
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const india = value => /\bindia\s*(?:\([^)]*\))?$/i.test(norm(value))
const locationKey = value => norm(value).replace(/\s*,\s*/g, ', ').toLowerCase()
const knownForeignCountries = (() => {
  const names = new Set(['united states of america', 'usa', 'uae', 'great britain'])
  const display = new Intl.DisplayNames(['en'], { type: 'region' })
  for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second)
    if (['IN', 'ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) continue
    const name = display.of(code)
    if (name && name !== code && !/unknown|pseudo/i.test(name)) {
      names.add(code.toLowerCase()); names.add(name.toLowerCase())
    }
  }
  return names
})()
const nonemptyIds = value => value.filter(v => v !== '')
const ids = value => Array.isArray(value) && value.length > 0
  && value.every(v => typeof v === 'string' && (v === '' || /^[a-zA-Z0-9_-]+$/.test(v)))
  && nonemptyIds(value).length > 0 && new Set(nonemptyIds(value)).size === nonemptyIds(value).length

function validHandoff(url, contract) {
  try {
    const u = new URL(url)
    if (u.origin !== contract.origin || u.username || u.password || u.hash) return false
    const paths = ['/ms/candidate/careers', `/ms/candidate/${contract.companyId}/careers`,
      `/ms/candidatev2/${contract.companyId}/careers/home`, `/ms/candidatev2/${contract.companyId}/careers/allJobs`]
    return paths.includes(u.pathname.replace(/\/$/, '')) && !u.search
  } catch { return false }
}
const officialUrl = (url, contract) => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password
      && [contract.companyDomain, `www.${contract.companyDomain}`, `careers.${contract.companyDomain}`].includes(u.hostname)
  } catch { return false }
}

export function extractDarwinboxCorporateHandoffs(html, baseUrl, source) {
  const contract = DARWINBOX_PARTIAL_CONTRACTS[source]
  requireProof(contract && typeof html === 'string', 'Supported corporate body required')
  return extractOfficialRecruitmentLinks(html, baseUrl).map(url => url.href).filter(url => validHandoff(url, contract))
}

function nativeIndiaScope(record) {
  requireProof(object(record) && typeof record.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(record.id)
    && norm(record.title) && norm(record.locations), 'Native listing identity/title/location required')
  requireProof(record.jd == null || typeof record.jd === 'string', 'Native description must be text')
  requireProof(record.country == null || typeof record.country === 'string', 'Native country must be a string')
  const country = norm(record.country)
  const labels = [record.locations]
  for (const field of ['officelocations_area', 'officelocations_without_area', 'officelocation_show_arr_list']) {
    if (record[field] == null) continue
    requireProof(Array.isArray(record[field]) && record[field].every(v => typeof v === 'string'), 'Native location labels malformed')
    // Native listing display arrays include blank separators alongside actual addresses.
    labels.push(...record[field].filter(v => norm(v)))
  }
  if (record.officelocation_arr != null) requireProof(ids(record.officelocation_arr), 'Native location IDs malformed')
  const inIndia = /^(india|in)$/i.test(country) || labels.some(india)
  if (inIndia) {
    requireProof(!country || /^(india|in)$/i.test(country), 'Conflicting native country evidence')
    requireProof(labels.every(v => india(v) || /^multiple locations$/i.test(norm(v))), 'Mixed or unproven native India locations')
    requireProof(labels.some(india) || /^(india|in)$/i.test(country), 'Native India scope unavailable')
  } else requireProof(knownForeignCountries.has(country.toLowerCase()), 'Native foreign country scope unavailable or unknown')
  return inIndia
}

export async function deriveDarwinboxPartialEvidence({ source, bindingEvidence: binding, httpEvidence, readEvidence, now = new Date() }) {
  const contract = DARWINBOX_PARTIAL_CONTRACTS[source]
  requireProof(contract, 'Unsupported Darwinbox partial source')
  requireProof(binding?.source === source && binding.companyName === contract.companyName
    && binding.companyDomain === contract.companyDomain && binding.origin === contract.origin
    && binding.companyId === contract.companyId && binding.listingUrl === contract.listingUrl
    && officialUrl(binding.careersUrl, contract) && validHandoff(binding.handoffUrl, contract)
    && fresh(binding.verifiedAt, now), 'Fresh official matching Darwinbox binding required')
  requireProof(httpEvidence?.mode === 'browser-public-native-http-capture'
    && Array.isArray(httpEvidence.receipts), 'Actual browser native HTTP provenance required')
  const read = async receipt => {
    requireProof(receipt && typeof receipt.file === 'string', 'HTTP evidence receipt required')
    const bytes = await readEvidence(receipt.file)
    requireProof(Buffer.isBuffer(bytes) && bytes.length === receipt.bytes && hash(bytes) === receipt.sha256,
      'HTTP evidence bytes/hash mismatch')
    return bytes
  }
  const archive = JSON.parse((await read(httpEvidence.archive)).toString('utf8'))
  requireProof(archive.source === source && archive.mode === httpEvidence.mode && archive.productionWrites === false
    && fresh(archive.capturedAt, now) && Array.isArray(archive.entries) && archive.entries.length > 0,
  'Fresh source-matched native archive required')
  const official = httpEvidence.receipts.filter(r => ['official-binding', 'official-binding-dom'].includes(r.kind))
  requireProof(official.length === 1, 'One exact corporate binding HTTP proof required')
  const receipt = official[0]
  requireProof(receipt.url === binding.careersUrl && receipt.status === 200
    && officialUrl(receipt.finalUrl || receipt.url, contract) && fresh(receipt.fetchedAt, now),
  'Successful fresh official corporate HTTP proof required')
  const html = (await read(receipt)).toString('utf8')
  if (receipt.kind === 'official-binding-dom') {
    requireProof(receipt.mode === 'rendered-official-page-dom' && receipt.navigationStatus === 200
      && ['rendered-footer-subtree', 'rendered-document'].includes(receipt.bodyKind),
    'Successful distinct DOM navigation provenance required')
    const dom = JSON.parse((await read(httpEvidence.officialArchive)).toString('utf8'))
    requireProof(dom.source === source && dom.mode === receipt.mode && dom.bodyKind === receipt.bodyKind
      && dom.navigationStatus === 200 && dom.status === 200 && dom.requestedURL === receipt.url
      && dom.finalURL === receipt.finalUrl && dom.completedAt === receipt.fetchedAt && dom.body === html,
    'Rendered DOM differs from exact captured corporate evidence')
  }
  const hrefs = extractDarwinboxCorporateHandoffs(html, receipt.finalUrl || receipt.url, source)
  requireProof(hrefs.includes(binding.handoffUrl), 'Corporate body does not contain exact official ATS handoff')
  const native = httpEvidence.receipts.filter(r => r.kind === 'native')
  requireProof(native.length === archive.entries.length && native.length + 1 === httpEvidence.receipts.length,
    'Every native archive packet must have exactly one body receipt')
  const packets = []
  const seenPackets = new Set()
  for (const r of native) {
    const e = archive.entries[r.packetIndex]
    requireProof(Number.isInteger(r.packetIndex) && e && !seenPackets.has(r.packetIndex)
      && r.url === e.request?.url && r.method === e.request?.method
      && r.requestBody === (e.request?.body ?? null) && r.requestBodySha256 === hash(e.request?.body || '')
      && r.status === e.response?.status && r.fetchedAt === archive.capturedAt
      && (!r.finalUrl || r.finalUrl === r.url)
      && (!e.response.finalURL || e.response.finalURL === r.url)
      && (!e.response.finalUrl || e.response.finalUrl === r.url), 'Native request identity/body/status receipt mismatch')
    seenPackets.add(r.packetIndex)
    const bytes = await read(r)
    requireProof(typeof e.response.body === 'string' && bytes.equals(Buffer.from(e.response.body)),
      'Native HTTP response differs from archive body')
    packets[r.packetIndex] = { ...e, body: bytes.toString('utf8') }
  }
  const listings = packets.filter(e => e.request.method === 'POST')
  requireProof(listings.length > 0, 'Native public listing POST proof required')
  const records = []; const seenIds = new Set(); let total; let limit
  for (const [index, e] of listings.entries()) {
    requireProof(e.request.url === contract.listingUrl && e.response.status === 200,
      'Native public listing origin/company/status mismatch')
    const request = JSON.parse(e.request.body)
    requireProof(object(request) && Object.keys(request).sort().join(',') === 'companyId,limit,page,sort_option'
      && request.companyId === contract.companyId && request.sort_option === 'new'
      && Number.isInteger(request.limit) && request.limit > 0 && request.limit <= 100
      && request.page === index + 1, 'Unfiltered contiguous native pagination required')
    limit ??= request.limit
    requireProof(request.limit === limit, 'Native pagination page size changed')
    const body = JSON.parse(e.body)
    requireProof(body.status === 'success' && Array.isArray(body.data)
      && Number.isSafeInteger(body.job_counts) && body.job_counts > 0, 'Native stable positive total required')
    total ??= body.job_counts
    requireProof(body.job_counts === total && body.data.length === Math.min(limit, Math.max(0, total - index * limit)),
      'Native pagination count/total mismatch')
    for (const record of body.data) {
      nativeIndiaScope(record)
      requireProof(!seenIds.has(record.id), 'Duplicate native vacancy ID across pages')
      seenIds.add(record.id); records.push(record)
    }
  }
  requireProof(records.length === total && archive.reportedTotal === total
    && listings.length >= Math.ceil(total / limit) && listings.length <= Math.ceil(total / limit) + 1,
  'Native complete inventory/end proof does not reconcile')
  const detailPackets = new Map()
  const parser = createDarwinboxScraper({ ...contract })
  for (const e of packets.filter(e => e.request.method !== 'POST')) {
    const match = records.find(r => e.request.url === parser.buildJobDetailApiUrl(r.id))
    requireProof(e.request.method === 'GET' && e.request.body == null && match
      && !detailPackets.has(match.id), 'Native detail origin/company/job ID or duplicate mismatch')
    detailPackets.set(match.id, e)
  }
  const mapped = []; let inspectedJobs = 0; let missingDescriptions = 0; let unavailable = 0
  for (const record of records) {
    if (!nativeIndiaScope(record)) continue
    inspectedJobs++
    let job = parser.extractSearchResults({ data: [{ ...record, country: 'India' }] })[0]
    requireProof(job, 'Native India role failed mapping')
    if (!hasSourceDescription(job)) {
      const e = detailPackets.get(record.id)
      requireProof(e, 'Missing captured native detail for contentless India role')
      if (e.response.status !== 200) {
        requireProof([401, 403, 404, 408, 429, 500, 502, 503, 504].includes(e.response.status), 'Unrecognized native detail failure')
        unavailable++
      } else {
        const body = JSON.parse(e.body)
        requireProof(body.status === 'success' && Array.isArray(body.message?.job) && body.message.job.length === 1,
          'Native detail payload malformed')
        const detail = body.message.job[0]
        const grouped = /^multiple locations$/i.test(norm(detail?.officelocation_show_arr))
        const detailLabels = grouped ? detail.tool_tip_locations : [detail?.officelocation_show_arr]
        requireProof(object(detail) && detail.id === record.id && norm(detail.title) === norm(record.title)
          && Array.isArray(detailLabels) && detailLabels.length > 0 && detailLabels.every(india)
          && (!detail.country || /^(india|in)$/i.test(norm(detail.country)))
          && (detail.jd == null || typeof detail.jd === 'string'), 'Native detail identity/title/country mismatch')
        if (detail.officelocation_show_arr_list != null) requireProof(Array.isArray(detail.officelocation_show_arr_list)
          && detail.officelocation_show_arr_list.length > 0 && detail.officelocation_show_arr_list.every(v => india(v)
            || (grouped && /^multiple locations$/i.test(norm(v)))),
        'Native detail locations lack India proof')
        for (const field of ['tool_tip_locations', 'officelocations_area', 'officelocations_without_area']) {
          if (detail[field] != null) requireProof(Array.isArray(detail[field]) && detail[field].length > 0
            && detail[field].every(india), 'Native detail additional locations lack India proof')
        }
        if (record.officelocation_arr != null || detail.officelocation_arr != null) requireProof(
          ids(record.officelocation_arr) && ids(detail.officelocation_arr)
          && canonical(nonemptyIds(record.officelocation_arr).sort()) === canonical(nonemptyIds(detail.officelocation_arr).sort()),
        'Native detail location IDs differ from listing')
        const listedLabels = [record.locations, ...(record.officelocations_area || []), ...(record.officelocation_show_arr_list || [])]
          .map(locationKey).filter(v => v && !/^multiple locations$/i.test(v))
        requireProof(detailLabels.every(v => listedLabels.includes(locationKey(v)))
          || (!grouped && detail.officelocation_show_arr_list?.every(v => listedLabels.includes(locationKey(v)))),
        'Native detail location differs from listing')
        job = parser.extractSearchResults({ data: [{ ...record, country: 'India', jd: detail.jd }] })[0]
      }
      if (!hasSourceDescription(job)) missingDescriptions++
    }
    const to = record.job_posting?.careers?.to
    if (to != null) {
      requireProof(Number.isFinite(Number(to)) && Number(to) > 0, 'Native closing date malformed')
      job.closingDate = new Date(Number(to) * 1000).toISOString()
      job.sourceClosingDateIsExact = true
    }
    mapped.push({ ...job, source, country: 'India', companyDomain: contract.companyDomain,
      companyCareerPage: binding.careersUrl, scrapedAt: archive.capturedAt,
      link: job.sourceUrl, sourceListingComplete: false, sourceDetailComplete: hasSourceDescription(job) })
  }
  const analysis = analyzePublishableJobs(mapped, { now })
  // Native careers.to is an exact instant; the common metrics helper compares
  // calendar days, while public visibility correctly closes roles immediately.
  const openJobs = analysis.eligibleJobs.filter(job => !job.closingDate || Date.parse(job.closingDate) > +now)
  analysis.filterCounts.closed += analysis.eligibleJobs.length - openJobs.length
  // Ingestion retains contentless rows privately for later recovery. A public
  // repair trial selects described roles, while its full native detail-health
  // evidence continues to account for every missing or unavailable description.
  analysis.eligibleJobs = openJobs.filter(job => hasSourceDescription(job))
  analysis.filterCounts.emptyDescription += openJobs.length - analysis.eligibleJobs.length
  requireProof(analysis.eligibleJobs.length > 0, 'No eligible positive jobs; failure is never zero inventory proof')
  return { jobs: analysis.eligibleJobs, rawTotal: total, publicTotal: records.length, indiaTotal: inspectedJobs,
    pagesFetched: listings.length, capturedAt: archive.capturedAt,
    detailHealth: { complete: missingDescriptions === 0, inspectedJobs, incompleteJobs: missingDescriptions,
      missingDescriptions, failureKinds: { ...(missingDescriptions - unavailable > 0 ? { 'missing-content': missingDescriptions - unavailable } : {}),
        ...(unavailable ? { upstream: unavailable } : {}) } },
    filterCounts: { ...analysis.filterCounts, nonIndia: records.length - inspectedJobs } }
}

export async function verifyDarwinboxPartialPublishingTrial({ trial, bytes, readEvidence, now = new Date() }) {
  requireProof(Buffer.isBuffer(bytes) && canonical(JSON.parse(bytes)) === canonical(trial), 'Trial differs from exact file bytes')
  requireProof(trial.schemaVersion === 1 && trial.mode === 'native-http-partial-positive-trial'
    && trial.outcome === 'positive-extraction-incomplete-evidence' && trial.productionWrites === false
    && fresh(trial.attemptedAt, now) && fresh(trial.completedAt, now)
    && Date.parse(trial.completedAt) >= Date.parse(trial.attemptedAt)
    && trial.maxJobs == null && trial.truncated !== true, 'Fresh untruncated Darwinbox partial trial required')
  const proof = await deriveDarwinboxPartialEvidence({ source: trial.source, bindingEvidence: trial.bindingEvidence,
    httpEvidence: trial.httpEvidence, readEvidence, now })
  const inventory = trial.inventoryEvidence; const listing = trial.publicListingProof
  requireProof(inventory?.status === 'discovery-only' && inventory.listingComplete === false && inventory.firstParty === true
    && inventory.surface === trial.bindingEvidence.listingUrl && inventory.reportedTotal === proof.rawTotal
    && inventory.indiaFacetCount === proof.indiaTotal && inventory.pagesFetched === proof.pagesFetched
    && fresh(inventory.verifiedAt, now), 'Partial inventory must preserve exact native scope and incomplete health')
  requireProof(listing?.fullResponse === true && listing.rawTotal === proof.rawTotal && listing.publicTotal === proof.publicTotal
    && listing.indiaTotal === proof.indiaTotal && listing.pagesFetched === proof.pagesFetched
    && listing.terminalReason === 'stable-total-reconciled', 'Full public listing proof does not reconcile')
  const ordered = jobs => [...jobs].sort((a, b) => a.jobId.localeCompare(b.jobId))
  requireProof(Array.isArray(trial.jobs) && trial.jobs.every(object)
    && canonical(ordered(trial.jobs)) === canonical(ordered(proof.jobs)),
  'Selected jobs differ from all eligible native role identities/content/location; truncation is forbidden')
  return { trial, trialByteHash: hash(bytes), eligibleJobs: proof.jobs.length, ...proof }
}
