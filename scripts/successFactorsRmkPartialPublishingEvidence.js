import { createHash } from 'node:crypto'
import { createSuccessFactorsRmkScraper, readRmkCompanyIdentities } from '../scraper-support/shared/successFactorsRmk.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'

// These first-party hosts and native company tokens were independently observed.
// Pin the reviewed original discovery bytes instead of accepting caller-defined identity.
export const RMK_DISCOVERY_SHA256 = 'c4fbb0555f376f92b05e3bd8c4bb387f0c8a04d4a4a30891e44a52749365e42b'
export const SUCCESSFACTORS_RMK_PARTIAL_CONTRACTS = Object.freeze({
  astellaspharma: Object.freeze({ source: 'astellaspharma', companyName: 'Astellas Pharma', companyDomain: 'astellas.com',
    origin: 'https://careers.astellas.com', companyToken: 'astellasT5', nativeCompanyName: 'Astellas',
    searchUrl: 'https://careers.astellas.com/search?locale=en_GB', sourceScopeComplete: false }),
})
const requireProof = (ok, message) => { if (!ok) throw new Error(message) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && Date.parse(value) <= +now && +now - Date.parse(value) <= 48 * 3600000

export async function deriveSuccessFactorsRmkPartialEvidence({ source, httpEvidence, readEvidence, now = new Date() }) {
  const contract = SUCCESSFACTORS_RMK_PARTIAL_CONTRACTS[source]
  requireProof(contract && Object.hasOwn(SUCCESSFACTORS_RMK_PARTIAL_CONTRACTS, source), 'Unsupported RMK source')
  const receipts = httpEvidence?.receipts
  requireProof(httpEvidence?.mode === 'direct-first-party-rmk-http-capture' && Array.isArray(receipts)
    && receipts.length >= 3 && receipts.length <= 10500 && new Set(receipts.map(r => r.file)).size === receipts.length,
  'Exact unique native and original official discovery receipts required')
  const packets = new Map(), proofs = new Map()
  let discovery = null, startedAt = null, capturedAt = null
  for (const receipt of receipts) {
    requireProof(['native', 'discovery', 'discovery-proof'].includes(receipt.kind), 'Unknown evidence kind')
    const bytes = await readEvidence(receipt.file)
    requireProof(Buffer.isBuffer(bytes) && bytes.length === receipt.bytes && hash(bytes) === receipt.sha256, 'Evidence bytes/hash mismatch')
    if (receipt.kind === 'discovery') {
      requireProof(!discovery && receipt.sha256 === RMK_DISCOVERY_SHA256, 'Original approved official discovery bytes required')
      discovery = JSON.parse(bytes); continue
    }
    if (receipt.kind === 'discovery-proof') {
      requireProof(typeof receipt.proofPath === 'string' && !proofs.has(receipt.proofPath), 'Unique official proof reference required')
      proofs.set(receipt.proofPath, { sha256: receipt.sha256, bytes: receipt.bytes }); continue
    }
    const packet = JSON.parse(bytes)
    requireProof(packet.source === source && packet.method === 'GET' && packet.status === 200
      && typeof packet.body === 'string' && hash(Buffer.from(packet.body)) === packet.bodySha256
      && typeof packet.contentType === 'string' && /^text\/html\b/i.test(packet.contentType)
      && fresh(packet.startedAt, now) && fresh(packet.completedAt, now)
      && Date.parse(packet.completedAt) >= Date.parse(packet.startedAt), 'Fresh successful exact native HTTP packet required')
    const url = new URL(packet.requestedURL)
    requireProof(url.origin === contract.origin && !url.username && !url.password && !url.hash
      && packet.finalURL === packet.requestedURL && !packets.has(packet.requestedURL), 'Native host, redirect or duplicate request mismatch')
    requireProof(/^\/search\/?$/.test(url.pathname) || /^\/job\/[^/]+\/\d+\/$/.test(url.pathname), 'Unexpected native route')
    if (url.pathname.startsWith('/job/')) {
      const names = readRmkCompanyIdentities(packet.body)
      requireProof(names.length > 0 && names.every(name => name === contract.nativeCompanyName), 'Native hiring company identity mismatch')
    }
    packets.set(packet.requestedURL, packet)
    if (!startedAt || packet.startedAt < startedAt) startedAt = packet.startedAt
    if (!capturedAt || packet.completedAt > capturedAt) capturedAt = packet.completedAt
  }
  const record = discovery?.records?.find(row => row.source === source)
  requireProof(discovery?.batchId === 'batch-007' && fresh(discovery.checkedAt, now) && record
    && fresh(record.checkedAt, now) && record.officialCareerSurfaceVerified === true
    && record.officialIdentityEvidenceStatus === 'current-official-page'
    && record.ats?.host === new URL(contract.origin).hostname && new URL(record.ats.boardURL).origin === contract.origin,
  'Fresh reviewed official first-party identity evidence required')
  requireProof(Array.isArray(record.proofFiles) && proofs.size === record.proofFiles.length
    && record.proofFiles.every(file => {
      const expected = discovery.proofIntegrity?.find(row => row.path === file), actual = proofs.get(file)
      return expected && actual && expected.sha256 === actual.sha256 && expected.bytes === actual.bytes
    }), 'Original official proof files do not match reviewed discovery')
  const used = new Set()
  const mapped = await createSuccessFactorsRmkScraper(contract).run({ fetchText: async url => {
    const packet = packets.get(url)
    requireProof(packet && !used.has(url), 'Missing or repeated native listing/detail packet')
    used.add(url); return packet.body
  } })
  requireProof(used.size === packets.size, 'Unused native packet; observed scope is not exact')
  const nativeInventory = readInventoryEvidence(mapped)
  requireProof(nativeInventory?.reportedTotal > 0 && mapped.length > 0, 'Positive observed native India inventory required')
  const jobs = mapped.map(job => ({ ...job, scrapedAt: capturedAt, source: source, company: contract.companyName,
    companyDomain: contract.companyDomain, companyCareerPage: record.careersURL,
    sourceListingComplete: false }))
  requireProof(jobs.every(job => !job.postingDate || Date.parse(job.postingDate) <= +now), 'Future native publication date requires separate visibility review')
  const analysis = analyzePublishableJobs(jobs, { now })
  requireProof(analysis.eligibleJobs.length > 0, 'No eligible native positive roles; never certify zero')
  const missing = jobs.filter(job => !hasSourceDescription(job)).length
  const incomplete = contract.sourceScopeComplete ? missing : jobs.length
  const inventoryEvidence = { status: 'coverage-gap', firstParty: true, listingComplete: false,
    surface: contract.searchUrl, reportedTotal: nativeInventory.reportedTotal, indiaFacetCount: jobs.length,
    pagesFetched: nativeInventory.pagesFetched, verifiedAt: capturedAt,
    reason: contract.sourceScopeComplete ? 'native-rmk-observed-listing-complete-required-descriptions-incomplete'
      : 'native-rmk-observed-locale-complete-additional-employer-scope-unresolved' }
  return { jobs: analysis.eligibleJobs, startedAt, capturedAt, rawTotal: nativeInventory.reportedTotal,
    publicTotal: nativeInventory.reportedTotal, indiaTotal: jobs.length, pagesFetched: nativeInventory.pagesFetched,
    listingUrl: contract.searchUrl, inventoryEvidence,
    observedSurfaceEvidence: { firstParty: true, listingComplete: true, surface: contract.searchUrl,
      reportedTotal: nativeInventory.reportedTotal, indiaFacetCount: jobs.length, pagesFetched: nativeInventory.pagesFetched,
      verifiedAt: capturedAt, employerScopeComplete: contract.sourceScopeComplete },
    bindingEvidence: { source, companyDomain: contract.companyDomain, nativeOrigin: contract.origin,
      nativeCompanyToken: contract.companyToken, nativeCompanyName: contract.nativeCompanyName,
      method: 'verified-first-party-careers-subdomain-and-native-company-identity',
      discoverySha256: RMK_DISCOVERY_SHA256, discoveryCheckedAt: record.checkedAt },
    detailHealth: { complete: incomplete === 0, inspectedJobs: jobs.length, incompleteJobs: incomplete,
      missingDescriptions: missing, failureKinds: { ...(missing ? { 'missing-content': missing } : {}),
        ...(!contract.sourceScopeComplete ? { 'employer-scope-unresolved': jobs.length } : {}) } },
    filterCounts: { ...analysis.filterCounts, nonIndia: nativeInventory.reportedTotal - jobs.length } }
}

export async function verifySuccessFactorsRmkPartialPublishingTrial({ trial, bytes, readEvidence, now = new Date() }) {
  requireProof(Buffer.isBuffer(bytes) && canonical(JSON.parse(bytes)) === canonical(trial), 'Trial differs from exact bytes')
  requireProof(trial.schemaVersion === 1 && trial.mode === 'native-http-partial-positive-trial'
    && trial.outcome === 'positive-extraction-incomplete-evidence' && trial.productionWrites === false
    && fresh(trial.attemptedAt, now) && fresh(trial.completedAt, now)
    && Date.parse(trial.completedAt) >= Date.parse(trial.attemptedAt)
    && trial.maxJobs == null && trial.truncated !== true, 'Fresh untruncated RMK partial trial required')
  const proof = await deriveSuccessFactorsRmkPartialEvidence({ source: trial.source, httpEvidence: trial.httpEvidence, readEvidence, now })
  requireProof(trial.attemptedAt === proof.startedAt && trial.completedAt === proof.capturedAt, 'Trial timestamps must match actual HTTP capture window')
  for (const field of ['inventoryEvidence', 'observedSurfaceEvidence', 'bindingEvidence', 'detailHealth', 'filterCounts']) {
    requireProof(canonical(trial[field]) === canonical(proof[field]), `Native ${field} differs from evidence`)
  }
  const ordered = jobs => [...jobs].sort((a, b) => a.jobId.localeCompare(b.jobId))
  requireProof(Array.isArray(trial.jobs) && canonical(ordered(trial.jobs)) === canonical(ordered(proof.jobs)),
    'Selected jobs differ from all eligible observed native identities/content/locations')
  return { trial, trialByteHash: hash(bytes), eligibleJobs: proof.jobs.length, ...proof }
}
