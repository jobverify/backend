import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fetchSmartRecruitersDetail } from '../scraper-support/apiPortal/smartRecruitersDetail.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js'
import { DARWINBOX_PARTIAL_CONTRACTS, verifyDarwinboxPartialPublishingTrial } from './darwinboxPartialPublishingEvidence.js'
import { KULA_PARTIAL_CONTRACTS, verifyKulaPartialPublishingTrial } from './kulaPartialPublishingEvidence.js'
import { SUCCESSFACTORS_RMK_PARTIAL_CONTRACTS, verifySuccessFactorsRmkPartialPublishingTrial } from './successFactorsRmkPartialPublishingEvidence.js'
import { WORKDAY_PARTIAL_CONTRACTS, verifyWorkdayPartialPublishingTrial } from './workdayPartialPublishingEvidence.js'
import { ZEE_PARTIAL_CONTRACTS, verifyZeePartialPublishingTrial } from './zeePartialPublishingEvidence.js'
import { NAVI_PARTIAL_CONTRACTS, verifyNaviPartialPublishingTrial } from './naviPartialPublishingEvidence.js'
import { IVALUE_PARTIAL_CONTRACTS, verifyIValuePartialPublishingTrial } from './ivaluePartialPublishingEvidence.js'
import { BOSTON_SCIENTIFIC_PARTIAL_CONTRACTS, verifyBostonScientificPartialPublishingTrial } from './bostonScientificPartialPublishingEvidence.js'
import { EINFOCHIPS_PARTIAL_CONTRACTS, verifyEInfochipsPartialPublishingTrial } from './eInfochipsPartialPublishingEvidence.js'
import { EXPERION_PARTIAL_CONTRACTS, verifyExperionPartialPublishingTrial } from './experionPartialPublishingEvidence.js'
import { AERIES_PARTIAL_CONTRACTS, verifyAeriesPartialPublishingTrial } from './aeriesPartialPublishingEvidence.js'
import { INDIGO_PARTIAL_CONTRACTS, verifyIndigoPartialPublishingTrial } from './indigoPartialPublishingEvidence.js'
import { CASTROL_PARTIAL_CONTRACTS, verifyCastrolPartialPublishingTrial } from './castrolPartialPublishingEvidence.js'
import { FINACUS_PARTIAL_CONTRACTS, verifyFinacusPartialPublishingTrial } from './finacusPartialPublishingEvidence.js'
import { CAPITAL_ONE_PARTIAL_CONTRACTS, verifyCapitalOnePartialPublishingTrial } from './capitalOnePartialPublishingEvidence.js'

export const partialTrialHash = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = message => { throw new Error(message) }
const requireProof = (condition, message) => { if (!condition) fail(message) }
const fresh = (value, now) => {
  const at = new Date(value)
  return value && Number.isFinite(at.getTime()) && at <= now && now - at <= 48 * 3600000
}
const CAREERS = 'https://www.phonepe.com/careers/job-openings/'
const LISTING = 'https://www.phonepe.com/apollo/job-postings/latest.json'
const COMPONENT = 'component---src-pages-careers-job-openings-index-js'
const parseReference = value => {
  const url = new URL(value)
  const match = url.pathname.match(/^\/PHONEPELIMITED\/(\d+)(?:-[^/]*)?\/?$/)
  requireProof(url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password && match,
    'Public posting company or ID mismatch')
  return match[1]
}

export function loadPartialTrial(file) {
  const filename = fs.realpathSync(file)
  const base = path.dirname(filename)
  const bytes = fs.readFileSync(filename)
  return { bytes, trial: JSON.parse(bytes.toString('utf8')), readEvidence: relative => {
    requireProof(typeof relative === 'string' && !path.isAbsolute(relative), 'Evidence must be relative')
    const resolved = fs.realpathSync(path.resolve(base, relative))
    const rel = path.relative(base, resolved)
    requireProof(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Evidence path escapes trial directory')
    return fs.readFileSync(resolved)
  } }
}

export function loadPartialTrialEntries({ trialFile, trialsDirectory } = {}) {
  requireProof(Boolean(trialFile) !== Boolean(trialsDirectory), 'Choose --trial or --trials')
  if (trialFile) return [loadPartialTrial(trialFile)]
  const input = fs.realpathSync(trialsDirectory)
  const manifestFile = fs.statSync(input).isDirectory() ? path.join(input, 'manifest.json') : input
  const directory = path.dirname(manifestFile)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  requireProof(Array.isArray(manifest.sources) && manifest.sources.length > 0 && manifest.sources.length <= 100
    && new Set(manifest.sources.map(row => row.source)).size === manifest.sources.length,
  'Manifest requires one to 100 unique sources')
  return manifest.sources.map(row => {
    requireProof(typeof row.file === 'string' && !path.isAbsolute(row.file), 'Trial file must be relative')
    const file = fs.realpathSync(path.resolve(directory, row.file))
    const relative = path.relative(directory, file)
    requireProof(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Trial path escapes manifest directory')
    const entry = loadPartialTrial(file)
    requireProof(row.source === entry.trial.source && row.trialByteHash === partialTrialHash(entry.bytes),
      'Manifest trial identity or bytes changed')
    return entry
  })
}

// Deliberately source-specific. Other employers need their own native listing
// contract and official handoff proof before this partial path can accept them.
export async function verifyPartialPublishingTrial({ trial, bytes, readEvidence, now = new Date() }) {
  if (Object.hasOwn(CAPITAL_ONE_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyCapitalOnePartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(FINACUS_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyFinacusPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(CASTROL_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyCastrolPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(INDIGO_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyIndigoPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(AERIES_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyAeriesPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(EXPERION_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyExperionPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(EINFOCHIPS_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyEInfochipsPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(BOSTON_SCIENTIFIC_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyBostonScientificPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(IVALUE_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyIValuePartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(NAVI_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyNaviPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(ZEE_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyZeePartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(WORKDAY_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyWorkdayPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(SUCCESSFACTORS_RMK_PARTIAL_CONTRACTS, trial?.source)) {
    return verifySuccessFactorsRmkPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(KULA_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyKulaPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  if (Object.hasOwn(DARWINBOX_PARTIAL_CONTRACTS, trial?.source)) {
    return verifyDarwinboxPartialPublishingTrial({ trial, bytes, readEvidence, now })
  }
  requireProof(Buffer.isBuffer(bytes) && JSON.stringify(JSON.parse(bytes.toString('utf8'))) === JSON.stringify(trial),
    'Trial object differs from exact file bytes')
  requireProof(trial?.source === 'phonepe' && trial.schemaVersion === 1
    && trial.mode === 'native-http-partial-positive-trial'
    && trial.outcome === 'positive-extraction-incomplete-evidence' && trial.productionWrites === false
    && fresh(trial.attemptedAt, now) && fresh(trial.completedAt, now)
    && new Date(trial.completedAt) >= new Date(trial.attemptedAt)
    && trial.maxJobs == null && trial.truncated !== true, 'Fresh untruncated native partial trial required')
  const binding = trial.bindingEvidence
  requireProof(binding?.source === trial.source && binding.companyName === 'PhonePe'
    && binding.companyDomain === 'phonepe.com' && binding.careersUrl === CAREERS
    && binding.listingUrl === LISTING && binding.expectedCompany === 'PHONEPELIMITED'
    && fresh(binding.verifiedAt, now), 'Official matching binding required')
  const inventory = trial.inventoryEvidence
  requireProof(inventory?.firstParty === true && inventory.status === 'discovery-only'
    && inventory.listingComplete === false && inventory.pagesFetched === 1
    && inventory.surface === LISTING && fresh(inventory.verifiedAt, now), 'Partial inventory evidence must remain incomplete')
  requireProof(trial.httpEvidence?.mode === 'native-direct-live-http'
    && Array.isArray(trial.httpEvidence.receipts), 'Native HTTP provenance required')
  const responses = new Map()
  for (const receipt of trial.httpEvidence.receipts) {
    const body = await readEvidence(receipt.file)
    requireProof(Buffer.isBuffer(body) && body.length === receipt.bytes
      && partialTrialHash(body) === receipt.sha256, 'HTTP evidence byte hash mismatch')
    requireProof(receipt.status === 200 && (!receipt.finalUrl || receipt.finalUrl === receipt.url)
      && fresh(receipt.fetchedAt, now) && !responses.has(receipt.url), 'Successful fresh unique HTTP receipt required')
    responses.set(receipt.url, body.toString('utf8'))
  }
  const get = url => {
    requireProof(responses.has(url), `Missing captured HTTP response: ${url}`)
    return responses.get(url)
  }
  for (const url of [binding.appUrl, binding.runtimeUrl, binding.componentUrl]) {
    requireProof(typeof url === 'string' && /^https:\/\/www\.phonepe\.com\/webstatic\/[^?#]+\.js$/.test(url),
      'Official JavaScript binding URL required')
  }
  const html = get(CAREERS)
  requireProof(html.includes(binding.appUrl) && html.includes(binding.runtimeUrl), 'Careers page does not reference binding scripts')
  const app = get(binding.appUrl)
  const route = app.slice(app.indexOf(`"${COMPONENT}":`)).split(').then(')[0]
  const runtime = get(binding.runtimeUrl)
  const stem = new URL(binding.componentUrl).pathname.split('/').at(-1)
  const chunkHash = stem.slice(`${COMPONENT}-`.length, -3)
  requireProof(Number.isSafeInteger(binding.componentChunkId)
    && app.includes(`"${COMPONENT}":`) && route.includes(`.e(${binding.componentChunkId})`)
    && stem.startsWith(`${COMPONENT}-`) && chunkHash
    && runtime.includes(`${binding.componentChunkId}:"${COMPONENT}"`)
    && runtime.includes(`${binding.componentChunkId}:"${chunkHash}"`), 'Official route component binding is incomplete')
  const component = get(binding.componentUrl)
  requireProof(component.includes(`fetch("${LISTING}")`) && component.includes('"PUBLIC"')
    && component.includes('applyUrl'), 'Official component does not bind the public feed')
  const payload = JSON.parse(get(LISTING))
  requireProof(Array.isArray(payload.results) && payload.results.every(r => r && typeof r === 'object')
    && Number.isSafeInteger(payload.totalCount) && payload.totalCount === payload.results.length
    && fresh(payload.fetchedAt, now), 'Fresh full native listing and exact total required')
  const publicRecords = payload.results.filter(r => r.status === 'PUBLIC')
  requireProof(publicRecords.length > 0 && publicRecords.every(r => typeof r.applyUrl === 'string' && r.applyUrl),
    'Every public listing must expose its posting identity')
  const proof = trial.publicListingProof
  requireProof(proof?.fullResponse === true && proof.pagesFetched === 1
    && proof.rawTotal === payload.totalCount && proof.publicTotal === publicRecords.length
    && inventory.reportedTotal === payload.totalCount
    && inventory.indiaFacetCount === publicRecords.length, 'Full-public-listing proof does not reconcile')
  const seen = new Set()
  const expected = new Map()
  let missingDescriptions = 0
  for (const record of publicRecords) {
    const id = parseReference(record.applyUrl)
    requireProof(!seen.has(id), 'Duplicate public vacancy identity')
    seen.add(id)
    const url = `https://api.smartrecruiters.com/v1/companies/PHONEPELIMITED/postings/${id}`
    const detail = JSON.parse(get(url))
    requireProof(String(detail.id) === id && detail.company?.identifier === 'PHONEPELIMITED'
      && parseReference(detail.postingUrl) === id, 'Native detail company/job identity mismatch')
    requireProof(typeof detail.location?.country === 'string' && detail.location.country.trim().toLowerCase() === 'in'
      && typeof detail.location.city === 'string' && detail.location.city.trim()
      && typeof record.location === 'string' && record.location.trim()
      && detail.location.city.trim().toLowerCase() === record.location.trim().toLowerCase(),
    'Native role location must establish India and match the public listing')
    let content
    try {
      content = await fetchSmartRecruitersDetail({ publicUrl: record.applyUrl, expectedCompany: 'PHONEPELIMITED',
        expectedCountry: 'in', expectedLocation: record.location,
        fetchJson: async requested => JSON.parse(get(requested)) })
    } catch (error) {
      // Only absent employer role content is an admissible incomplete detail.
      if (/missing employer role description/.test(error.message)) { missingDescriptions++; continue }
      throw error
    }
    expected.set(record.applyUrl, { record, content })
  }
  requireProof(Array.isArray(trial.jobs) && trial.jobs.length > 0 && trial.jobs.length === expected.size,
    'All eligible native roles required; truncated or empty jobs are not publishable')
  for (const job of trial.jobs) {
    const match = expected.get(job.applyUrl)
    requireProof(match && job.source === 'phonepe' && job.company === 'PhonePe'
      && job.sourceListingComplete === false && job.sourceUrl === job.applyUrl && job.link === job.applyUrl
      && job.jobId === job.applyUrl && job.title === match.record.title && job.location === match.record.location
      && job.country === 'India' && job.jobDescription === match.content.jobDescription
      && (job.sourceDescription == null || job.sourceDescription === job.jobDescription)
      && (job.description == null || job.description === job.jobDescription),
    'Job identity, apply URL, location or employer content differs from native evidence')
    expected.delete(job.applyUrl)
  }
  requireProof(expected.size === 0, 'Missing or duplicate eligible role')
  const analysis = analyzePublishableJobs(trial.jobs, { now })
  requireProof(analysis.eligibleJobs.length === trial.jobs.length, 'Every selected job must retain publication quality')
  requireProof(publicRecords.length - trial.jobs.length === missingDescriptions,
    'Every excluded public role must have captured missing employer content')
  return { trial, trialByteHash: partialTrialHash(bytes), eligibleJobs: trial.jobs.length,
    rawTotal: payload.totalCount, publicTotal: publicRecords.length,
    detailHealth: { complete: missingDescriptions === 0, inspectedJobs: publicRecords.length,
      incompleteJobs: missingDescriptions, missingDescriptions,
      failureKinds: missingDescriptions ? { 'missing-content': missingDescriptions } : {} },
    // Native country and posting URLs were verified for every public record.
    // Lifecycle and aggregate-role rejection checks cover only selected roles;
    // do not invent whole-feed zeros for the excluded contentless records.
    filterCounts: { nonIndia: 0, invalidUrl: 0, emptyDescription: missingDescriptions,
      closed: null, nonJob: null, old: null } }
}

export async function planPartialPublishingRollout({ entries, validation, now = new Date() }) {
  requireProof(Array.isArray(entries) && entries.length > 0 && entries.length <= 100
    && new Set(entries.map(e => e.trial.source)).size === entries.length, 'One to 100 unique sources required')
  requireProof(validation?.environment === 'temporary-local-mongodb' && validation.productionWrites === false
    && validation.passedSources === entries.length && fresh(validation.generatedAt, now), 'Fresh temporary Mongo validation required')
  const verified = []
  for (const entry of entries) {
    const proof = await verifyPartialPublishingTrial({ ...entry, now })
    const rows = validation.rows?.filter(row => row.source === proof.trial.source)
    const row = rows?.[0]
    requireProof(rows?.length === 1 && row.outcome === 'passed' && row.idempotent === true
      && row.priorJobsPreserved === true && row.partialStatusPreserved === true
      && row.visibleJobs === proof.eligibleJobs && row.eligibleJobs === proof.eligibleJobs,
    'Passing partial persistence and visibility validation required')
    requireProof(row.trialByteHash === proof.trialByteHash, 'Trial file bytes changed after local validation')
    verified.push(proof)
  }
  return { sourceCount: verified.length, verified,
    batches: Array.from({ length: Math.ceil(verified.length / 10) }, (_, i) =>
      verified.slice(i * 10, (i + 1) * 10).map(p => p.trial.source)) }
}

export const PARTIAL_SAVE_OPTIONS = Object.freeze({ enrichPublicExperience: false, enqueueAlerts: false,
  descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false })

export const buildPartialAttempt = (proof, result, now) => ({
  success: false, partial: true, softFailure: false, failureKind: 'partial_positive',
  error: 'Validated positive jobs published; source extraction completeness remains unverified.',
  rawRecords: proof.rawTotal, jobs: proof.indiaTotal ?? proof.publicTotal, eligibleJobs: proof.eligibleJobs,
  detailHealth: proof.detailHealth,
  filteredEmptyDescription: proof.filterCounts.emptyDescription,
  filteredNonIndia: proof.filterCounts.nonIndia, filteredInvalidUrl: proof.filterCounts.invalidUrl,
  filteredClosed: proof.filterCounts.closed, filteredNonJob: proof.filterCounts.nonJob,
  filteredOld: proof.filterCounts.old,
  inserted: result.inserted, updated: result.updated, deleted: result.deleted,
  missed: result.missed, expired: result.expired,
  staleCheckSkipped: true, staleCheckReason: 'Partial-positive upsert only; all previous vacancies preserved.',
  attemptedAt: proof.trial.attemptedAt, completedAt: now.toISOString(),
  inventoryEvidence: proof.trial.inventoryEvidence,
})

export async function recordPartialPublishingStatus(database, source, attempt) {
  requireProof(attempt.success === false && attempt.inventoryEvidence?.listingComplete === false,
    'Partial status cannot claim complete success')
  const result = await database.collection('scraperstatuses').updateOne({ source, isActive: true }, { $set: {
    lastRanAt: new Date(attempt.completedAt), lastSuccess: false, lastPartialAt: new Date(attempt.completedAt),
    lastPartialReason: attempt.staleCheckReason, lastError: attempt.error,
    softFailure: false, upstreamOutage: false, failureKind: 'partial_positive', latestAttempt: attempt,
  } })
  requireProof(result.matchedCount === 1, 'Active administrator status required for partial status update')
}

export async function countVisiblePartialJobs(database, trial, siteSettings, now = new Date()) {
  const query = applyPublicJobVisibility({ source: trial.source, sourceUrl: { $in: trial.jobs.map(j => j.sourceUrl) },
    status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }] }, siteSettings)
  const rows = await database.collection('jobs').find(query, { projection: { sourceUrl: 1 }, maxTimeMS: 30000 }).toArray()
  return new Set(rows.map(row => row.sourceUrl)).size
}

export async function executePartialPublishingRollout({ entries, validation, now = new Date(),
  collectSnapshot, saveJobs, recordPartialStatus, verifyVisibility, checkpoint, captureSnapshot = async () => {} }) {
  const plan = await planPartialPublishingRollout({ entries, validation, now })
  const progress = { mode: 'partial-positive-upsert', startedAt: now.toISOString(), completed: false,
    beforeCompanies: null, afterCompanies: null, companiesChange: null, rows: [], batches: [],
    writeAttempts: [], phase: 'before-snapshot' }
  const snapshot = async name => {
    const value = await collectSnapshot()
    requireProof(value.databaseAvailable === true && Array.isArray(value.statuses)
      && Array.isArray(value.inventory) && Array.isArray(value.publicCompanyNames), 'Public snapshot unavailable')
    requireProof(value.siteSettings?.experiencedJobsEnabled === validation.siteSettings?.experiencedJobsEnabled,
      'Public visibility settings changed after local validation')
    await captureSnapshot(name, value)
    return value
  }
  try {
    const before = await snapshot('before')
    progress.beforeCompanies = before.publicCompanyNames.length
    await checkpoint(progress)
    for (const batch of plan.batches) {
      const current = await snapshot(`batch-${progress.batches.length + 1}-before`)
      for (const source of batch) {
        requireProof(current.statuses.find(s => s.source === source)?.isActive === true,
          'Explicit active administrator setting required')
        const proof = plan.verified.find(p => p.trial.source === source)
        progress.phase = 'upserting-source'; progress.currentSource = source
        const writeAttempt = { source, phase: 'started', inserted: null, updated: null }
        progress.writeAttempts.push(writeAttempt)
        await checkpoint(progress)
        const result = await saveJobs(proof.trial.jobs, source, { ...PARTIAL_SAVE_OPTIONS })
        Object.assign(writeAttempt, { phase: 'upsert-returned', inserted: result?.inserted ?? null,
          updated: result?.updated ?? null, deleted: result?.deleted ?? null,
          expired: result?.expired ?? null, missed: result?.missed ?? null })
        await checkpoint(progress)
        requireProof(result && ['inserted', 'updated', 'deleted', 'missed', 'expired'].every(k =>
          Number.isInteger(result[k]) && result[k] >= 0) && result.deleted === 0 && result.missed === 0 && result.expired === 0,
        'Partial upsert returned invalid counts or unexpected cleanup')
        await recordPartialStatus(source, buildPartialAttempt(proof, result, new Date()))
        writeAttempt.phase = 'partial-status-recorded'
        progress.rows.push({ source, inserted: result.inserted, updated: result.updated, eligibleJobs: proof.eligibleJobs,
          extractionComplete: false })
        await checkpoint(progress)
      }
      progress.phase = 'verifying-batch'
      const afterBatch = await snapshot(`batch-${progress.batches.length + 1}-after`)
      const outcomes = []
      for (const source of batch) {
        const proof = plan.verified.find(p => p.trial.source === source)
        const count = await verifyVisibility(proof.trial, afterBatch.siteSettings)
        requireProof(count === proof.eligibleJobs, 'Exact selected role public visibility verification failed')
        outcomes.push({ source, visibleSelectedJobs: count })
      }
      progress.batches.push({ outcomes, completedAt: new Date().toISOString() })
      await checkpoint(progress)
    }
    const after = await snapshot('after')
    progress.afterCompanies = after.publicCompanyNames.length
    progress.companiesChange = progress.afterCompanies - progress.beforeCompanies
    progress.completed = true; progress.phase = 'complete'
  } catch (error) {
    progress.phase = 'stopped'
    // Do not expose driver errors, which can contain connection secrets.
    progress.error = 'Partial publication stopped; inspect saved checkpoints and verify applied roles before retrying.'
    progress.failureCode = error?.code || null
  } finally {
    progress.completedAt = new Date().toISOString()
    await checkpoint(progress)
  }
  return progress
}
