// Historical report observations only. These files never qualify a publication.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const requireFact = (condition, reason) => { if (!condition) throw new Error(reason) }
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
const times = trial => ({ attemptedAt: timestamp(trial?.attemptedAt), completedAt: timestamp(trial?.completedAt),
  inventoryVerifiedAt: timestamp(trial?.inventoryEvidence?.verifiedAt) })
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

function readEvidence(base, relative) {
  requireFact(typeof relative === 'string' && relative && !path.isAbsolute(relative), 'Evidence path must be relative')
  const file = fs.realpathSync(path.resolve(base, relative)), rel = path.relative(base, file)
  requireFact(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Evidence path escapes trial directory')
  return fs.readFileSync(file)
}

function receiptIndex(trial) {
  const receipts = trial?.httpEvidence?.receipts
  requireFact(Array.isArray(receipts) && receipts.length > 0 && receipts.length <= 50000, 'Frozen HTTP receipts missing')
  const seen = new Set()
  return receipts.map(({file, bytes, sha256}) => {
    requireFact(typeof file === 'string' && file && !seen.has(file) && Number.isSafeInteger(bytes)
      && bytes >= 0 && digest(sha256), 'Frozen receipt index malformed or duplicated')
    seen.add(file)
    return { file, bytes, sha256 }
  })
}

function checkReceipts(base, receipts) {
  for (const receipt of receipts) {
    const bytes = readEvidence(base, receipt.file)
    requireFact(bytes.length === receipt.bytes && hash(bytes) === receipt.sha256, 'Frozen evidence receipt bytes changed')
  }
}

function writeImmutable(filename, bytes) {
  try { fs.writeFileSync(filename, bytes, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    requireFact(fs.readFileSync(filename).equals(bytes), 'Immutable report facts already differ')
  }
}

function historicalAudit(facts, index, indexFile) {
  return { ...facts.audit, supportingEvidence: [...facts.audit.supportingEvidence, {
    mode: 'immutable-historical-partial-report-facts', factsSha256: index.factsSha256,
    indexFile, indexSha256: hash(jsonBytes(index)), checkedAt: index.checkedAt,
    evidenceReceiptIndexSha256: index.evidenceReceiptIndexSha256,
    publicationQualification: false,
  }] }
}

/** Read exact frozen historical facts; invoke live gates only to create a new cache. */
export async function readOrCreatePartialReportAudit({ source, trialFile, artifact, expectedTrialByteHash,
  cacheDirectory, now = new Date(), supportingEvidence = [] }) {
  let originalTimes = {}, observedTrialHash = null
  const key = hash(`${source}\0${artifact}`)
  // Preserve the observation's clock even when its cache is damaged. Reading
  // these labels never makes its counts or inventory usable.
  try { originalTimes = times(JSON.parse(fs.readFileSync(trialFile))) } catch {}
  try {
    requireFact(typeof source === 'string' && source && typeof artifact === 'string' && artifact,
      'Historical source and artifact required')
    const candidates = fs.existsSync(cacheDirectory)
      ? fs.readdirSync(cacheDirectory).filter(name => name.startsWith(`${key}-`) && name.endsWith('.index.json')) : []
    requireFact(candidates.length <= 1, 'Ambiguous immutable report facts indexes')
    let index
    if (candidates.length) {
      const bytes = fs.readFileSync(path.join(cacheDirectory, candidates[0]))
      requireFact(candidates[0] === `${key}-${hash(bytes)}.index.json`, 'Report facts index bytes changed')
      index = JSON.parse(bytes)
      requireFact(index.schemaVersion === 1 && index.kind === 'historical-partial-report-index'
        && index.source === source && index.artifact === artifact, 'Report facts index identity changed')
      originalTimes = index.originalTimes
    }
    const filename = fs.realpathSync(trialFile), base = path.dirname(filename), bytes = fs.readFileSync(filename)
    const trial = JSON.parse(bytes)
    if (!index) originalTimes = times(trial)
    observedTrialHash = hash(bytes)
    requireFact(trial.source === source && digest(expectedTrialByteHash)
      && observedTrialHash === expectedTrialByteHash, 'Frozen trial identity or expected byte hash changed')
    const receipts = receiptIndex(trial), receiptHash = hash(jsonBytes(receipts))
    checkReceipts(base, receipts)
    if (index) {
      requireFact(index.trialByteHash === observedTrialHash && equal(index.originalTimes, times(trial))
        && index.evidenceReceiptIndexSha256 === receiptHash && equal(index.evidenceReceipts, receipts)
        && timestamp(index.checkedAt) && digest(index.factsSha256)
        && index.factsFile === `${index.factsSha256}.facts.json`, 'Report facts provenance changed')
      const factsBytes = fs.readFileSync(path.join(cacheDirectory, index.factsFile))
      requireFact(hash(factsBytes) === index.factsSha256 && factsBytes.length === index.factsBytes,
        'Historical report facts bytes changed')
      const facts = JSON.parse(factsBytes)
      requireFact(facts.schemaVersion === 1 && facts.kind === 'historical-partial-report-facts'
        && facts.source === source && facts.artifact === artifact && facts.trialByteHash === observedTrialHash
        && facts.evidenceReceiptIndexSha256 === receiptHash && equal(facts.originalTimes, originalTimes)
        && facts.audit.source === source && facts.audit.artifact === artifact
        && facts.audit.attemptedAt === originalTimes.attemptedAt && facts.audit.completedAt === originalTimes.completedAt,
      'Historical report facts identity changed')
      return historicalAudit(facts, index, candidates[0])
    }

    // Never imported on a historical read: current source code and qualification
    // deadlines cannot invalidate an already verified observation of old bytes.
    const { verifyPartialPublishingTrial } = await import('./partialPublishingGapEvidence.js')
    const proof = await verifyPartialPublishingTrial({ trial, bytes, now,
      readEvidence: relative => readEvidence(base, relative) })
    requireFact(proof.trialByteHash === observedTrialHash && proof.trial.source === source,
      'Publication verification returned a different trial')
    const facts = { schemaVersion: 1, kind: 'historical-partial-report-facts', source, artifact,
      trialByteHash: observedTrialHash, originalTimes, evidenceReceiptIndexSha256: receiptHash,
      audit: { source, attemptedAt: originalTimes.attemptedAt, completedAt: originalTimes.completedAt,
        outcome: trial.outcome, mode: trial.mode, productionWrites: false,
        rawJobs: proof.rawTotal, extractedJobs: trial.jobs.length, indiaJobs: proof.indiaTotal ?? proof.publicTotal,
        eligibleJobs: proof.eligibleJobs, detailHealth: proof.detailHealth, filterCounts: proof.filterCounts,
        inventoryEvidence: trial.inventoryEvidence, artifact,
        supportingEvidence: [...supportingEvidence, { trialByteHash: observedTrialHash }] } }
    const factsBytes = jsonBytes(facts), factsSha256 = hash(factsBytes)
    index = { schemaVersion: 1, kind: 'historical-partial-report-index', source, artifact,
      trialByteHash: observedTrialHash, originalTimes, checkedAt: new Date(now).toISOString(),
      verification: { module: 'scripts/partialPublishingGapEvidence.js',
        sha256: hash(fs.readFileSync(new URL('./partialPublishingGapEvidence.js', import.meta.url))),
        mode: 'existing-source-specific-publication-verifier', historicalObservationOnly: true },
      evidenceReceiptIndexSha256: receiptHash, evidenceReceipts: receipts,
      factsFile: `${factsSha256}.facts.json`, factsSha256, factsBytes: factsBytes.length }
    const indexBytes = jsonBytes(index), indexFile = `${key}-${hash(indexBytes)}.index.json`
    fs.mkdirSync(cacheDirectory, { recursive: true })
    writeImmutable(path.join(cacheDirectory, index.factsFile), factsBytes)
    writeImmutable(path.join(cacheDirectory, indexFile), indexBytes)
    return historicalAudit(facts, index, indexFile)
  } catch (error) {
    return { source, attemptedAt: originalTimes?.attemptedAt ?? null, completedAt: originalTimes?.completedAt ?? null,
      outcome: 'extraction-failed', mode: 'historical-partial-report-facts-unavailable', productionWrites: false,
      rawJobs: null, extractedJobs: null, indiaJobs: null, eligibleJobs: null,
      filterCounts: null, detailHealth: null, inventoryEvidence: null,
      failureKind: 'evidence-unavailable', failureCode: 'partial-report-facts-unavailable',
      error: `Historical partial audit unavailable: ${error.message}`, artifact,
      supportingEvidence: [{ originalTimes, expectedTrialByteHash: expectedTrialByteHash ?? null,
        observedTrialByteHash: observedTrialHash, cacheDirectory, publicationQualification: false,
        reason: error.message }] }
  }
}
