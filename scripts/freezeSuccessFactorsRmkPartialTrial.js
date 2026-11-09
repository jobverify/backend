import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { deriveSuccessFactorsRmkPartialEvidence, verifySuccessFactorsRmkPartialPublishingTrial } from './successFactorsRmkPartialPublishingEvidence.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const confinedFile = (directory, relative) => {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Relative evidence path required')
  const file = fs.realpathSync(path.resolve(directory, relative))
  const rel = path.relative(directory, file)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Evidence path escapes archive')
  return file
}

// Offline copy and verification of actual raw HTTP bytes. Never fetch, infer
// missing responses from mapped jobs, truncate inventory, or reuse a release dir.
export async function freezeSuccessFactorsRmkPartialTrial({ nativeManifestFile, discoveryFile, outputDirectory, now = new Date() }) {
  const nativePath = fs.realpathSync(nativeManifestFile), discoveryPath = fs.realpathSync(discoveryFile)
  const archive = JSON.parse(fs.readFileSync(nativePath))
  const discoveryBytes = fs.readFileSync(discoveryPath), discovery = JSON.parse(discoveryBytes)
  const source = archive.source, record = discovery.records?.find(row => row.source === source)
  if (!record || !Array.isArray(archive.packets) || !archive.packets.length) throw new Error('Actual native capture manifest and approved source discovery required')
  const bodies = new Map([['evidence/discovery.json', discoveryBytes]])
  const receipts = [{ kind: 'discovery', file: 'evidence/discovery.json', bytes: discoveryBytes.length, sha256: hash(discoveryBytes) }]
  for (const proofPath of record.proofFiles) {
    const bytes = fs.readFileSync(confinedFile(path.dirname(discoveryPath), proofPath))
    const file = `evidence/discovery/${proofPath}`
    bodies.set(file, bytes); receipts.push({ kind: 'discovery-proof', proofPath, file, bytes: bytes.length, sha256: hash(bytes) })
  }
  for (const packet of archive.packets) {
    const nativeFile = confinedFile(path.dirname(nativePath), packet.file)
    const bytes = fs.readFileSync(nativeFile)
    if (hash(bytes) !== packet.sha256) throw new Error('Actual native capture file hash changed')
    const native = JSON.parse(bytes)
    if (native.requestedURL !== packet.requestedURL || native.status !== packet.status
      || native.bodySha256 !== packet.bodySha256) throw new Error('Native manifest/packet mismatch')
    const file = `evidence/native/${path.relative(path.dirname(nativePath), nativeFile).replaceAll('\\', '/')}`
    if (bodies.has(file)) throw new Error('Duplicate native capture file')
    bodies.set(file, bytes); receipts.push({ kind: 'native', file, bytes: bytes.length, sha256: hash(bytes) })
  }
  const httpEvidence = { mode: 'direct-first-party-rmk-http-capture', receipts }
  const readEvidence = async file => bodies.get(file)
  const proof = await deriveSuccessFactorsRmkPartialEvidence({ source, httpEvidence, readEvidence, now })
  const trial = { schemaVersion: 1, source, mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: proof.startedAt, completedAt: proof.capturedAt, httpEvidence,
    inventoryEvidence: proof.inventoryEvidence, observedSurfaceEvidence: proof.observedSurfaceEvidence,
    bindingEvidence: proof.bindingEvidence, detailHealth: proof.detailHealth, filterCounts: proof.filterCounts, jobs: proof.jobs }
  const bytes = Buffer.from(JSON.stringify(trial, null, 2) + '\n')
  const verified = await verifySuccessFactorsRmkPartialPublishingTrial({ trial, bytes, readEvidence, now })
  fs.mkdirSync(outputDirectory)
  for (const [file, contents] of bodies) {
    const output = path.join(outputDirectory, file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, contents, { flag: 'wx' })
  }
  const file = path.join(outputDirectory, `${source}.json`)
  fs.writeFileSync(file, bytes, { flag: 'wx' })
  const receipt = { source, file, trialByteHash: verified.trialByteHash, productionWrites: false,
    rawTotal: proof.rawTotal, indiaTotal: proof.indiaTotal, eligibleJobs: proof.jobs.length,
    detailHealth: proof.detailHealth, observedSurfaceComplete: true, employerScopeComplete: proof.observedSurfaceEvidence.employerScopeComplete,
    inventoryComplete: false, capturedAt: proof.capturedAt, frozenAt: now.toISOString() }
  fs.writeFileSync(path.join(outputDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  if (!option('--native-manifest') || !option('--discovery') || !option('--output')) throw new Error('--native-manifest, --discovery and unused --output directory required')
  console.log(JSON.stringify(await freezeSuccessFactorsRmkPartialTrial({ nativeManifestFile: option('--native-manifest'),
    discoveryFile: option('--discovery'), outputDirectory: path.resolve(option('--output')) })))
}
