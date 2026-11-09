import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DARWINBOX_PARTIAL_CONTRACTS, deriveDarwinboxPartialEvidence, extractDarwinboxCorporateHandoffs } from './darwinboxPartialPublishingEvidence.js'
import { partialTrialHash, verifyPartialPublishingTrial } from './partialPublishingGapEvidence.js'

// Offline only: consumes actual raw HTTP archives and never opens a network or database connection.
export async function freezeDarwinboxPartialTrial({ captureFile, officialFile, outputDirectory, now = new Date() }) {
  const archiveBytes = fs.readFileSync(captureFile)
  const officialBytes = fs.readFileSync(officialFile)
  const archive = JSON.parse(archiveBytes)
  const official = JSON.parse(officialBytes)
  const contract = DARWINBOX_PARTIAL_CONTRACTS[archive.source]
  if (!contract || official.source !== archive.source || typeof official.body !== 'string'
    || (official.bodySha256 != null && partialTrialHash(Buffer.from(official.body)) !== official.bodySha256)) {
    throw new Error('Source-matched original corporate body/hash required')
  }
  const handoffUrl = extractDarwinboxCorporateHandoffs(official.body, official.finalURL || official.requestedURL, archive.source)[0]
  const bindingEvidence = { ...contract, careersUrl: official.requestedURL, handoffUrl,
    verifiedAt: official.completedAt }
  const files = new Map()
  const put = (file, bytes) => {
    files.set(file, bytes)
    return { file, bytes: bytes.length, sha256: partialTrialHash(bytes) }
  }
  const archiveReceipt = put('evidence/native-archive.json', archiveBytes)
  const officialArchive = put('evidence/official-archive.json', officialBytes)
  const rendered = official.mode === 'rendered-official-page-dom'
  const receipts = [{ kind: rendered ? 'official-binding-dom' : 'official-binding',
    ...(rendered ? { mode: official.mode, bodyKind: official.bodyKind, navigationStatus: official.navigationStatus } : {}),
    url: official.requestedURL, finalUrl: official.finalURL,
    status: official.status, fetchedAt: official.completedAt,
    ...put('evidence/official.body', Buffer.from(official.body)) }]
  archive.entries.forEach((entry, packetIndex) => receipts.push({ kind: 'native', packetIndex,
    url: entry.request.url, method: entry.request.method, requestBody: entry.request.body ?? null,
    requestBodySha256: partialTrialHash(entry.request.body || ''), status: entry.response.status,
    fetchedAt: archive.capturedAt,
    ...put(`evidence/native-${packetIndex}.body`, Buffer.from(entry.response.body)) }))
  const httpEvidence = { mode: 'browser-public-native-http-capture', archive: archiveReceipt, officialArchive, receipts }
  const readEvidence = file => files.get(file)
  const proof = await deriveDarwinboxPartialEvidence({ source: archive.source, bindingEvidence, httpEvidence, readEvidence, now })
  const trial = { schemaVersion: 1, source: archive.source, mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: archive.capturedAt, completedAt: now.toISOString(), bindingEvidence, httpEvidence,
    inventoryEvidence: { status: 'discovery-only', firstParty: true, listingComplete: false,
      surface: contract.listingUrl, reportedTotal: proof.rawTotal, indiaFacetCount: proof.indiaTotal,
      pagesFetched: proof.pagesFetched, verifiedAt: archive.capturedAt, reason: 'native-detail-incomplete' },
    publicListingProof: { fullResponse: true, rawTotal: proof.rawTotal, publicTotal: proof.publicTotal,
      indiaTotal: proof.indiaTotal, pagesFetched: proof.pagesFetched, terminalReason: 'stable-total-reconciled' },
    detailHealth: proof.detailHealth, filterCounts: proof.filterCounts, jobs: proof.jobs }
  const bytes = Buffer.from(JSON.stringify(trial, null, 2) + '\n')
  const verified = await verifyPartialPublishingTrial({ trial, bytes, readEvidence, now })
  // Validation finishes before creating an immutable, unused release directory.
  fs.mkdirSync(outputDirectory)
  fs.mkdirSync(path.join(outputDirectory, 'evidence'))
  for (const [file, body] of files) fs.writeFileSync(path.join(outputDirectory, file), body, { flag: 'wx' })
  const trialFile = path.join(outputDirectory, `${trial.source}.json`)
  fs.writeFileSync(trialFile, bytes, { flag: 'wx' })
  const receipt = { createdAt: now.toISOString(), source: trial.source, trialFile: path.basename(trialFile),
    trialByteHash: verified.trialByteHash, productionWrites: false, rawTotal: verified.rawTotal,
    indiaTotal: proof.indiaTotal, eligibleJobs: verified.eligibleJobs, detailHealth: verified.detailHealth,
    nativeArchiveHash: partialTrialHash(archiveBytes), corporateArchiveHash: partialTrialHash(officialBytes),
    persistenceValidation: 'not-run' }
  fs.writeFileSync(path.join(outputDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
  return { ...receipt, trialFile }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  if (!option('--capture') || !option('--official') || !option('--output')) {
    throw new Error('--capture, --official and unused --output directory required')
  }
  console.log(JSON.stringify(await freezeDarwinboxPartialTrial({ captureFile: path.resolve(option('--capture')),
    officialFile: path.resolve(option('--official')), outputDirectory: path.resolve(option('--output')) })))
}
