import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'

// Positive-only exception for these exact reviewed bytes. Other captures or
// changed extraction code need their own independent review and contract.
export const AERIES_PARTIAL_CONTRACTS = Object.freeze({
  aeriestechnology: Object.freeze({
    companyName: 'Aeries Technology', companyDomain: 'aeriestechnology.com',
    careersUrl: 'https://aeriestechnology.com/careers/', boardUrl: 'https://aeriestechnology.talentrecruit.com/Search/',
    listingUrl: 'https://aeriestechnology.talentrecruit.com/Services/SearchJobsService.asmx/GetHotLinksAndJobs',
    releaseSha256: '91e673d6fa92709283f50032226003660a367eaf945d806e1d12ff54c6afca77',
    manifestSha256: '641e1bd51b63fcf520fdc5be239274d4ea066d7e6db89c21fd79f8d40a65cfee',
    captureTrialSha256: '79af9b0db0d037ad8bca6535f663c296899c398d8da530da2a8d462cd5b7a8e9',
    frozenTrialSha256: '600f983d70202f135cb3b45c21d44b23bb1d3fb52ed137827c271daa794d226c',
    attestationSha256: 'a46767e71ef2a8e03bf6820013c5bb8e88e92234e77888c2fe4905391f50c382',
    reviewSha256: 'c91869add35d34a7fdc06de5e1854f91a7fa6711b5992a261b84bcd6d397c94d',
    providerSha256: '3c623e0b1bf454d619adee2eac894d6dbbb22e2af19dc7c1b9a100712c98dc08',
  }),
})
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prove = (ok, message) => { if (!ok) throw new Error('Aeries partial proof: ' + message) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const fresh = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= +now && +now - Date.parse(value) <= 48 * 3600000
const undecorated = jobs => jobs.map(({ scrapedAt, companyCareerPage, companyDomain, atsPlatform, ...job }) => job)
const stableInventory = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => key !== 'verifiedAt'))
const identityFor = provider => ({ source: provider.source, companyName: provider.companyName, adapter: provider.adapter,
  atsPlatform: provider.atsPlatform, companyCareerPage: provider.companyCareerPage, companyDomain: provider.companyDomain,
  jobsBoardUrl: provider.jobsBoardUrl, modulePath: path.relative(backend, provider.modulePath).replaceAll('\\', '/') })

function isolatedReplay(packets, now) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { kind: 'aeries-reviewed-native-replay', packets, now }, execArgv: [], stdout: true, stderr: true })
    worker.stdout.on('data', () => {}); worker.stderr.on('data', () => {})
    let settled = false
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result) }
    const timer = setTimeout(() => finish(new Error('Aeries offline replay deadline exceeded')), 30000)
    worker.on('error', error => finish(error))
    worker.on('exit', code => { if (!settled) finish(new Error('Aeries replay exited without proof: ' + code)) })
    worker.on('message', message => message.error ? finish(new Error(message.error)) : finish(null, message.result))
  })
}

export async function deriveAeriesPartialEvidence({ source, httpEvidence, readEvidence, now = new Date() }) {
  prove(Object.hasOwn(AERIES_PARTIAL_CONTRACTS, source), 'unsupported exact source')
  const c = AERIES_PARTIAL_CONTRACTS[source], receipts = httpEvidence?.receipts, groups = new Map()
  prove(httpEvidence?.mode === 'reviewed-aeries-talentrecruit-exact-native-capture' && Array.isArray(receipts) && receipts.length === 43
    && new Set(receipts.map(row => row.file)).size === 43, 'all43 unique reviewed evidence receipts required')
  const kinds = ['release-manifest', 'capture-manifest', 'capture-trial', 'frozen-trial', 'code-attestation', 'independent-review', 'provider-identity', 'native', 'source-code']
  for (const receipt of receipts) {
    prove(kinds.includes(receipt.kind) && typeof receipt.file === 'string' && /^evidence\/[a-z0-9._/-]+$/i.test(receipt.file)
      && !receipt.file.split('/').includes('..'), 'confined recognized evidence required')
    const bytes = await readEvidence(receipt.file)
    prove(Buffer.isBuffer(bytes) && bytes.length === receipt.bytes && hash(bytes) === receipt.sha256, 'evidence bytes/hash mismatch')
    if (!groups.has(receipt.kind)) groups.set(receipt.kind, [])
    groups.get(receipt.kind).push({ receipt, bytes })
  }
  const single = (kind, expected) => { const rows = groups.get(kind); prove(rows?.length === 1 && rows[0].receipt.sha256 === expected, 'exact reviewed ' + kind + ' hash required'); return JSON.parse(rows[0].bytes) }
  const release = single('release-manifest', c.releaseSha256), manifest = single('capture-manifest', c.manifestSha256)
  const nativeTrial = single('capture-trial', c.captureTrialSha256), frozen = single('frozen-trial', c.frozenTrialSha256)
  const attestation = single('code-attestation', c.attestationSha256), review = single('independent-review', c.reviewSha256)
  const providerIdentity = single('provider-identity', c.providerSha256)
  const entry = release.trials?.find(row => row.source === source)
  prove(release.productionWrites === false && entry?.sha256 === c.frozenTrialSha256 && entry.nativeCaptureManifestSha256 === c.manifestSha256
    && manifest.productionWrites === false && manifest.trialSha256 === c.captureTrialSha256 && fresh(manifest.checkedAt, now), 'reviewed release/capture identity required')
  prove(frozen.source === source && frozen.mode === 'isolated-direct-live-extraction-no-database' && frozen.productionWrites === false
    && frozen.outcome === 'positive-extraction-incomplete-evidence' && fresh(frozen.attemptedAt, now) && fresh(frozen.completedAt, now)
    && Date.parse(frozen.completedAt) >= Date.parse(frozen.attemptedAt), 'fresh original frozen trial window required')
  prove(nativeTrial.productionWrites === false && fresh(nativeTrial.checkedAt, now) && fresh(nativeTrial.inventoryEvidence?.verifiedAt, now)
    && Date.parse(nativeTrial.checkedAt) >= Date.parse(nativeTrial.inventoryEvidence.verifiedAt)
    && Date.parse(nativeTrial.checkedAt) - Date.parse(nativeTrial.inventoryEvidence.verifiedAt) <= 180000
    && Date.parse(frozen.completedAt) >= Date.parse(nativeTrial.checkedAt) && Date.parse(frozen.completedAt) - Date.parse(nativeTrial.checkedAt) <= 5 * 60000, 'native capture and later exact frozen trial clocks must stay distinct')
  prove(review.source === source && review.reviewStatus === 'clear-partial-native-description-health-retained' && fresh(review.checkedAt, now)
    && review.remainingConfirmedBlockers?.length === 0 && review.current?.nativeRecords === 24 && review.current.eligibleJobs === 22
    && attestation.source === source && fresh(attestation.checkedAt, now) && attestation.originalFrozenSha256 === c.frozenTrialSha256
    && attestation.originalReleaseSha256 === c.releaseSha256, 'fresh final independent review and corrected-code attestation required')
  const codes = groups.get('source-code') || [], currentCode = () => {
    prove(codes.length === 5 && review.code?.length === 5 && new Set(codes.map(row => row.receipt.sourcePath)).size === 5, 'full reviewed extraction/binding code closure required')
    for (const row of codes) {
      const approved = review.code.find(code => code.path === row.receipt.sourcePath)
      prove(approved && approved.sha256 === row.receipt.sha256 && approved.bytes === row.bytes.length
        && hash(fs.readFileSync(path.join(backend, approved.path))) === approved.sha256, 'current reviewed source-code identity changed')
      if (approved.path.startsWith('scraper/aeriestechnology/')) prove(attestation.currentSourceHashes[path.basename(approved.path)] === approved.sha256, 'corrected-code version mismatch')
    }
  }
  currentCode()
  const { getScraperCatalog } = await import('../scraper-support/providers/index.js')
  const provider = getScraperCatalog().find(row => row.source === source)
  prove(provider && canonical(identityFor(provider)) === canonical(providerIdentity) && provider.companyName === c.companyName
    && provider.companyDomain === c.companyDomain && provider.companyCareerPage === c.careersUrl
    && provider.adapter === 'script' && provider.atsPlatform === 'talentrecruit' && provider.jobsBoardUrl === c.boardUrl
    && path.resolve(provider.modulePath) === path.join(backend, 'scraper/aeriestechnology/script.js'), 'current provider identity differs from reviewed source')
  const native = groups.get('native') || [], packets = []
  prove(native.length === 31 && manifest.packets?.length === 31 && new Set(native.map(row => row.receipt.originFile)).size === 31, 'all31 exact native packets required')
  for (const item of native) {
    const approved = manifest.packets.find(row => row.file === item.receipt.originFile), packet = JSON.parse(item.bytes)
    prove(approved && approved.sha256 === item.receipt.sha256 && approved.url === packet.url && approved.status === 200
      && packet.status === 200 && packet.finalURL === packet.url && typeof packet.body === 'string' && hash(Buffer.from(packet.body)) === packet.bodySha256
      && ['GET', 'POST'].includes(packet.method) && fresh(packet.startedAt, now) && fresh(packet.checkedAt, now)
      && Date.parse(packet.checkedAt) >= Date.parse(packet.startedAt) && Date.parse(packet.startedAt) >= Date.parse(nativeTrial.inventoryEvidence.verifiedAt)
      && Date.parse(packet.checkedAt) <= Date.parse(nativeTrial.checkedAt), 'fresh successful exact native packet required')
    prove(packet.method === 'POST' ? packet.url === c.listingUrl : packet.requestBody === null, 'native method/body contract changed')
    packets.push(packet)
  }
  prove(frozen.rawJobs === 24 && frozen.extractedJobs === 24 && frozen.indiaJobs === 24 && frozen.eligibleJobs === 22
    && Array.isArray(frozen.jobs) && frozen.jobs.length === 24 && new Set(frozen.jobs.map(row => row.jobId)).size === 24, 'original24 unique India records required')
  prove(frozen.inventoryEvidence?.status === 'coverage-gap' && frozen.inventoryEvidence.firstParty === true
    && frozen.inventoryEvidence.listingComplete === false && frozen.inventoryEvidence.pagesFetched === 2
    && frozen.inventoryEvidence.surface === c.listingUrl && frozen.inventoryEvidence.reportedTotal === 24 && frozen.inventoryEvidence.indiaFacetCount === 24
    && fresh(frozen.inventoryEvidence.verifiedAt, now), 'original partial24-record inventory must remain incomplete')
  prove(frozen.jobs.every(job => job.source === source && job.company === c.companyName && job.country === 'India' && job.sourceListingComplete === false
    && job.companyCareerPage === c.careersUrl && job.companyDomain === c.companyDomain && job.atsPlatform === 'talentrecruit'
    && typeof job.jobId === 'string' && /^[1-9]\d*$/.test(job.jobId) && job.requisitionId === job.jobId
    && job.sourceUrl === job.applyUrl && job.link === job.sourceUrl && job.sourceClosingDateIsExact === false), 'original native identity or lifecycle flags changed')
  const missing = frozen.jobs.filter(job => job.sourceDetailComplete !== true)
  prove(canonical(missing.map(job => job.jobId).sort()) === canonical(['3331', '3332']) && missing.every(job => job.sourceDetailComplete === false
    && job.sourceDescription === null && job.jobDescription === null), 'only two actual native placeholders may be incomplete')
  const replay = await isolatedReplay(packets, nativeTrial.inventoryEvidence.verifiedAt)
  prove(replay.requestsUsed === 31 && canonical(replay.jobs) === canonical(nativeTrial.jobs), 'corrected code must exactly replay every original capture job and clock')
  prove(canonical(undecorated(replay.jobs)) === canonical(undecorated(frozen.jobs)), 'all original frozen native fields must match the capture')
  prove(canonical(stableInventory(replay.inventoryEvidence)) === canonical(stableInventory(frozen.inventoryEvidence)), 'original partial inventory differs on replay')
  currentCode()
  const analysis = analyzePublishableJobs(frozen.jobs, { now })
  prove(analysis.indiaJobs.length === 24 && analysis.eligibleJobs.length === 22 && analysis.eligibleJobs.every(job => job.sourceDetailComplete === true && hasSourceDescription(job))
    && canonical(analysis.filterCounts) === canonical(frozen.filterCounts) && analysis.filterCounts.emptyDescription === 2, 'all and only22 original full native descriptions may qualify')
  const corporate = native.find(item => JSON.parse(item.bytes).url === c.careersUrl)
  prove(corporate, 'current corporate handoff packet required')
  return { jobs: analysis.eligibleJobs, startedAt: frozen.attemptedAt, capturedAt: frozen.completedAt, rawTotal: 24, publicTotal: 24, indiaTotal: 24, pagesFetched: 2,
    listingUrl: c.listingUrl, inventoryEvidence: frozen.inventoryEvidence, detailHealth: frozen.detailHealth,
    selectedDetailHealth: { complete: true, inspectedJobs: 22, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} }, filterCounts: frozen.filterCounts,
    bindingEvidence: { source, companyName: c.companyName, companyDomain: c.companyDomain, careersUrl: c.careersUrl, listingUrl: c.listingUrl, boardUrl: c.boardUrl,
      verifiedAt: JSON.parse(corporate.bytes).checkedAt, corporateProofSha256: corporate.receipt.sha256, independentReviewSha256: c.reviewSha256,
      scope: 'current-verified-Aeries-TalentRecruit-board-only', nativeClientLabelsKeptDistinct: true },
    originalCapture: { releaseManifestSha256: c.releaseSha256, nativeManifestSha256: c.manifestSha256, nativeTrialSha256: c.captureTrialSha256,
      frozenTrialSha256: c.frozenTrialSha256, correctedCodeAttestationSha256: c.attestationSha256,
      nativeObservedAt: nativeTrial.inventoryEvidence.verifiedAt, nativeCompletedAt: nativeTrial.checkedAt,
      attemptedAt: frozen.attemptedAt, completedAt: frozen.completedAt, bytesPreserved: true, nativeRecords: 24, nativeMissingDescriptions: 2 },
    replayEvidence: { mode: 'isolated-offline-exact-native-replay-no-network-no-database', requestsUsed: 31, observedNativeJobs: 24, selectedJobs: 22 } }
}

export async function verifyAeriesPartialPublishingTrial({ trial, bytes, readEvidence, now = new Date() }) {
  prove(Buffer.isBuffer(bytes) && canonical(JSON.parse(bytes)) === canonical(trial), 'trial object differs from exact bytes')
  prove(Object.hasOwn(AERIES_PARTIAL_CONTRACTS, trial?.source) && trial.schemaVersion === 1 && trial.mode === 'native-http-partial-positive-trial'
    && trial.outcome === 'positive-extraction-incomplete-evidence' && trial.productionWrites === false && trial.success !== true && trial.extractionComplete !== true
    && trial.maxJobs == null && trial.truncated !== true && trial.rawJobs === 24 && trial.indiaJobs === 24 && trial.globalTotal === 24 && trial.observedSelectedIndia === 22,
  'fresh untruncated partial22 publication with original24 scope required')
  const derived = await deriveAeriesPartialEvidence({ source: trial.source, httpEvidence: trial.httpEvidence, readEvidence, now })
  prove(trial.attemptedAt === derived.startedAt && trial.completedAt === derived.capturedAt, 'original frozen trial clocks required')
  for (const field of ['inventoryEvidence', 'bindingEvidence', 'detailHealth', 'selectedDetailHealth', 'filterCounts', 'originalCapture']) prove(canonical(trial[field]) === canonical(derived[field]), field + ' differs from native proof')
  prove(Array.isArray(trial.jobs) && canonical(trial.jobs) === canonical(derived.jobs), 'all and only22 eligible native jobs must retain every original field')
  return { ...derived, trial, trialByteHash: hash(bytes), eligibleJobs: 22 }
}

if (!isMainThread && workerData?.kind === 'aeries-reviewed-native-replay') {
  const replay = async () => {
    const mongoose = (await import('mongoose')).default, denied = () => { throw new Error('Offline Aeries replay blocks database access') }
    mongoose.connect = denied; mongoose.createConnection = denied; mongoose.Connection.prototype.openUri = denied
    const { MongoClient } = await import('mongodb'); MongoClient.connect = denied; MongoClient.prototype.connect = denied
    const { packets, now } = workerData, used = new Set()
    globalThis.fetch = async (url, init = {}) => {
      const index = packets.findIndex((packet, i) => !used.has(i) && packet.url === String(url) && packet.method === (init.method || 'GET') && packet.requestBody === (init.body ?? null))
      prove(index >= 0, 'uncaptured or repeated native request'); used.add(index)
      const packet = packets[index]
      return { status: packet.status, url: packet.finalURL, text: async () => packet.body }
    }
    const { run } = await import('../scraper/aeriestechnology/script.js')
    const { readInventoryEvidence } = await import('../scraper-support/utils/inventoryEvidence.js')
    const jobs = await run({ fetchImpl: globalThis.fetch, now, signal: AbortSignal.timeout(25000) })
    prove(used.size === 31, 'unused native packet')
    return { jobs, inventoryEvidence: readInventoryEvidence(jobs), requestsUsed: used.size }
  }
  replay().then(result => parentPort.postMessage({ result }), error => parentPort.postMessage({ error: error.message }))
}
