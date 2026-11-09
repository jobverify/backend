import { createHash } from 'node:crypto'
import { extractKulaNativeJobs, resolveKulaJobDescriptions } from '../scraper-support/utils/kulaFlight.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'
import { extractOfficialRecruitmentLinks } from './officialRecruitmentLinks.js'
import { mapKulaJobs as acko } from '../scraper/acko/script.js'
import { mapKulaJobs as plumhq } from '../scraper/plumhq/script.js'
import { mapKulaJobs as goodera } from '../scraper/goodera/script.js'
import { mapKulaJobs as clevertap } from '../scraper/clevertap/script.js'
import { mapKulaJobs as avoma } from '../scraper/avoma/script.js'

export const KULA_PARTIAL_CONTRACTS = Object.freeze({
  acko: { careersUrl: 'https://www.acko.com/careers/jobs/', companyDomain: 'acko.com', accountId: 1339, extract: acko },
  plumhq: { careersUrl: 'https://www.plumhq.com/careers', companyDomain: 'plumhq.com', accountId: 1297, extract: plumhq },
  goodera: { careersUrl: 'https://www.goodera.com/about/contact-us', companyDomain: 'goodera.com', accountId: 1480, extract: goodera },
  clevertap: { careersUrl: 'https://clevertap.com/current-openings/', companyDomain: 'clevertap.com', accountId: 1350, extract: clevertap },
  avoma: { careersUrl: 'https://www.avoma.com/careers', companyDomain: 'avoma.com', accountId: 1278, extract: avoma },
})
const requireProof = (condition, message) => { if (!condition) throw new Error(message) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && Date.parse(value) <= +now && +now - Date.parse(value) <= 48 * 3600000
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const date = value => value == null ? null : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const indiaLabel = value => /(?:^|,\s*)india$/i.test(norm(value))

function indiaOffice(office, source) {
  requireProof(office && typeof office === 'object' && !Array.isArray(office), 'Native office object required')
  for (const field of ['country', 'country_code', 'location', 'name', 'location_key']) {
    requireProof(office[field] == null || typeof office[field] === 'string', 'Native office fields must be text')
  }
  const country = norm(office.country); const code = norm(office.country_code).toUpperCase()
  if (source === 'avoma' && office.city != null) {
    requireProof(typeof office.city === 'string' && (!norm(office.city)
      || norm(office.city).toLowerCase() === norm(office.location).split(',')[0].toLowerCase()),
    'Native city conflicts with full location')
  }
  const inIndia = /^india$/i.test(country) || code === 'IN' || indiaLabel(office.location)
  if (inIndia) {
    requireProof((!country || /^india$/i.test(country)) && (!code || code === 'IN'), 'Conflicting native India country evidence')
    requireProof(!office.location || indiaLabel(office.location), 'Native India location conflicts with country')
    return true
  }
  // This exact observed ACKO office is a city-specific remote role. It has no
  // country field; the native New Delhi label/key supplies its India evidence.
  if (source === 'acko' && office.id === 2011 && !country && !code && office.location == null
    && office.name === 'New Delhi' && office.location_key === 'remote(new delhi)' && office.remote === true) return true
  requireProof(/^[A-Z]{2}$/.test(code) && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)
    && regions.of(code) !== code && norm(regions.of(code)).toLowerCase() === country.toLowerCase(),
  'Native foreign geography unavailable or unknown')
  requireProof(!indiaLabel(office.location), 'Conflicting foreign location evidence')
  return false
}

export async function deriveKulaPartialEvidence({ source, httpEvidence, readEvidence, now = new Date() }) {
  const contract = KULA_PARTIAL_CONTRACTS[source]
  requireProof(contract, 'Unsupported Kula source')
  requireProof(httpEvidence?.mode === 'direct-public-kula-html-capture'
    && Array.isArray(httpEvidence.receipts) && httpEvidence.receipts.length === 2,
  'Exact official and native public HTTP captures required')
  const captures = {}
  for (const receipt of httpEvidence.receipts) {
    requireProof(['official', 'native'].includes(receipt.kind) && !captures[receipt.kind], 'One capture per evidence kind required')
    const bytes = await readEvidence(receipt.file)
    requireProof(Buffer.isBuffer(bytes) && bytes.length === receipt.bytes && hash(bytes) === receipt.sha256, 'Capture bytes/hash mismatch')
    const archive = JSON.parse(bytes)
    requireProof(archive.source === source && archive.status === 200 && typeof archive.body === 'string'
      && archive.sha256 === hash(Buffer.from(archive.body)) && fresh(archive.startedAt, now) && fresh(archive.completedAt, now)
      && Date.parse(archive.completedAt) >= Date.parse(archive.startedAt), 'Fresh successful exact native capture required')
    captures[receipt.kind] = archive
  }
  const listingUrl = `https://careers.kula.ai/${source}?jobs=true`
  const { official, native } = captures
  requireProof(official.url === contract.careersUrl && official.finalURL === contract.careersUrl
    && native.url === listingUrl && native.finalURL === listingUrl, 'Exact current corporate/native URLs required')
  const links = extractOfficialRecruitmentLinks(official.body, official.finalURL)
  requireProof(links.some(url => url.origin === 'https://careers.kula.ai' && !url.username && !url.password
    && !url.hash && [ `/${source}`, `/${source}/` ].includes(url.pathname) && ['', '?jobs=true'].includes(url.search)),
  'Exact official corporate ATS anchor or iframe required')
  const rows = extractKulaNativeJobs(native.body, { accountName: source })
  requireProof(rows.length > 0, 'Positive observed native inventory required')
  // Map the validated account model itself. A second regex over the full HTML
  // could let unrelated commented/quoted job lists replace native content.
  const resolvedRows = resolveKulaJobDescriptions(native.body, rows)
  const mappedById = new Map(contract.extract(resolvedRows).map(job => [String(job.jobId), job]))
  const mapped = []
  for (const row of rows) {
    requireProof((Number.isSafeInteger(row.id) && row.id > 0) || (typeof row.id === 'string'
      && /^[1-9]\d*$/.test(row.id) && Number.isSafeInteger(Number(row.id))), 'Native numeric role identity required')
    requireProof(row.account_id === contract.accountId && row.listed === true && row.is_confidential === false
      && ['external', 'internal_and_external'].includes(row.kind) && norm(row.title), 'Native public employer/role identity required')
    const launched = date(row.launch_at); const closing = date(row.end_at)
    requireProof(launched !== undefined && closing !== undefined && (!launched || Date.parse(launched) <= +now),
      'Invalid or future native role dates')
    const offices = row.ats_job?.offices
    requireProof(Array.isArray(offices) && offices.length > 0, 'Native office evidence required')
    const scopes = offices.map(office => indiaOffice(office, source))
    if (!scopes.some(Boolean)) continue
    const job = mappedById.get(String(row.id))
    requireProof(job && norm(job.title) === norm(row.title) && /^india$/i.test(job.country), 'Native India role failed identity/location mapping')
    const url = `https://careers.kula.ai/${source}/${row.id}/?jobs=true`
    requireProof(job.sourceUrl === url && job.applyUrl === url, 'Native apply URL identity mismatch')
    mapped.push({ ...job, source, country: 'India', companyDomain: contract.companyDomain,
      companyCareerPage: contract.careersUrl, scrapedAt: native.completedAt, link: job.applyUrl,
      postingDate: launched, closingDate: closing, ...(closing ? { sourceClosingDateIsExact: true } : {}),
      sourceListingComplete: false, sourceDetailComplete: hasSourceDescription(job) })
  }
  const analysis = analyzePublishableJobs(mapped, { now })
  requireProof(analysis.eligibleJobs.length > 0, 'No eligible positive roles; unavailable inventory cannot establish zero')
  const missing = mapped.filter(job => !hasSourceDescription(job)).length
  return { jobs: analysis.eligibleJobs, rawTotal: rows.length, publicTotal: rows.length, indiaTotal: mapped.length,
    capturedAt: native.completedAt, pagesFetched: 1, listingUrl,
    detailHealth: { complete: missing === 0, inspectedJobs: mapped.length, incompleteJobs: missing,
      missingDescriptions: missing, failureKinds: missing ? { 'missing-content': missing } : {} },
    filterCounts: { ...analysis.filterCounts, nonIndia: rows.length - mapped.length } }
}

export async function verifyKulaPartialPublishingTrial({ trial, bytes, readEvidence, now = new Date() }) {
  requireProof(Buffer.isBuffer(bytes) && canonical(JSON.parse(bytes)) === canonical(trial), 'Trial differs from exact bytes')
  requireProof(trial.schemaVersion === 1 && trial.mode === 'native-http-partial-positive-trial'
    && trial.outcome === 'positive-extraction-incomplete-evidence' && trial.productionWrites === false
    && fresh(trial.attemptedAt, now) && fresh(trial.completedAt, now)
    && Date.parse(trial.completedAt) >= Date.parse(trial.attemptedAt)
    && trial.maxJobs == null && trial.truncated !== true, 'Fresh untruncated Kula partial trial required')
  const proof = await deriveKulaPartialEvidence({ source: trial.source, httpEvidence: trial.httpEvidence, readEvidence, now })
  const inventory = trial.inventoryEvidence
  requireProof(inventory?.status === 'discovery-only' && inventory.firstParty === true && inventory.listingComplete === false
    && inventory.surface === proof.listingUrl && inventory.reportedTotal == null && inventory.observedRecords === proof.rawTotal
    && inventory.indiaFacetCount === proof.indiaTotal && inventory.pagesFetched === 1 && fresh(inventory.verifiedAt, now)
    && inventory.reason === 'observed-kula-page-whole-board-completeness-unverified', 'Observed inventory must remain explicitly partial')
  const ordered = jobs => [...jobs].sort((a, b) => a.jobId.localeCompare(b.jobId))
  requireProof(Array.isArray(trial.jobs) && canonical(ordered(trial.jobs)) === canonical(ordered(proof.jobs)),
    'Selected jobs differ from all eligible observed native identities/content/locations')
  return { trial, trialByteHash: hash(bytes), eligibleJobs: proof.jobs.length, ...proof }
}
