import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { deriveKulaPartialEvidence } from './kulaPartialPublishingEvidence.js'
import { partialTrialHash, verifyPartialPublishingTrial } from './partialPublishingGapEvidence.js'

// Offline transformation of actual archived HTTP responses, with no network,
// database access, mutable release reuse or claim of complete board enumeration.
export async function freezeKulaPartialTrial({ nativeFile, officialFile, outputDirectory, now = new Date() }) {
  const nativeBytes = fs.readFileSync(nativeFile)
  const officialBytes = fs.readFileSync(officialFile)
  const native = JSON.parse(nativeBytes)
  const bodies = new Map([['evidence/native.json', nativeBytes], ['evidence/official.json', officialBytes]])
  const receipt = (kind, bytes) => ({ kind, file: `evidence/${kind}.json`, bytes: bytes.length, sha256: partialTrialHash(bytes) })
  const httpEvidence = { mode: 'direct-public-kula-html-capture', receipts: [receipt('official', officialBytes), receipt('native', nativeBytes)] }
  const readEvidence = file => bodies.get(file)
  const proof = await deriveKulaPartialEvidence({ source: native.source, httpEvidence, readEvidence, now })
  const trial = { schemaVersion: 1, source: native.source, mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: native.startedAt, completedAt: now.toISOString(), httpEvidence,
    inventoryEvidence: { status: 'discovery-only', firstParty: true, listingComplete: false,
      surface: proof.listingUrl, reportedTotal: null, observedRecords: proof.rawTotal, indiaFacetCount: proof.indiaTotal,
      pagesFetched: 1, verifiedAt: native.completedAt, reason: 'observed-kula-page-whole-board-completeness-unverified' },
    detailHealth: proof.detailHealth, filterCounts: proof.filterCounts, jobs: proof.jobs }
  const bytes = Buffer.from(JSON.stringify(trial, null, 2) + '\n')
  const verified = await verifyPartialPublishingTrial({ trial, bytes, readEvidence, now })
  fs.mkdirSync(outputDirectory)
  fs.mkdirSync(path.join(outputDirectory, 'evidence'))
  for (const [file, body] of bodies) fs.writeFileSync(path.join(outputDirectory, file), body, { flag: 'wx' })
  const file = path.join(outputDirectory, `${trial.source}.json`)
  fs.writeFileSync(file, bytes, { flag: 'wx' })
  const receiptData = { source: trial.source, file, trialByteHash: verified.trialByteHash, productionWrites: false,
    rawTotal: proof.rawTotal, indiaTotal: proof.indiaTotal, eligibleJobs: proof.jobs.length, detailHealth: proof.detailHealth,
    inventoryComplete: false, completedAt: now.toISOString() }
  fs.writeFileSync(path.join(outputDirectory, 'receipt.json'), JSON.stringify(receiptData, null, 2) + '\n', { flag: 'wx' })
  return receiptData
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  if (!option('--native') || !option('--official') || !option('--output')) throw new Error('--native, --official and unused --output directory required')
  console.log(JSON.stringify(await freezeKulaPartialTrial({ nativeFile: option('--native'), officialFile: option('--official'),
    outputDirectory: path.resolve(option('--output')) })))
}
