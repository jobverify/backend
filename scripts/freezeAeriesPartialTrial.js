import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { AERIES_PARTIAL_CONTRACTS, deriveAeriesPartialEvidence, verifyAeriesPartialPublishingTrial } from './aeriesPartialPublishingEvidence.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const confinedFile = (directory, relative) => {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Relative native archive path required')
  const file = fs.realpathSync(path.resolve(directory, relative)), rel = path.relative(directory, file)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !fs.statSync(file).isFile()) throw new Error('Native path escapes archive')
  return file
}

// Preserve all original24 records and31 raw responses. Only22 proven full-JD
// rows go into the new positive-only release; their native fields stay exact.
export async function freezeAeriesPartialTrial({ archiveDirectory, outputDirectory, now = new Date() }) {
  if (fs.existsSync(outputDirectory)) throw new Error('Output directory already exists')
  const archive = fs.realpathSync(archiveDirectory), c = AERIES_PARTIAL_CONTRACTS.aeriestechnology
  const read = relative => fs.readFileSync(confinedFile(archive, relative))
  const releaseBytes = read('release-manifest-001.json'), manifestBytes = read('aeries-full-native-002/manifest.json')
  if (hash(releaseBytes) !== c.releaseSha256 || hash(manifestBytes) !== c.manifestSha256) throw new Error('Exact reviewed release/native manifest hash required')
  const manifest = JSON.parse(manifestBytes), reviewBytes = read('aeries-independent-review-010.json'), review = JSON.parse(reviewBytes)
  if (hash(reviewBytes) !== c.reviewSha256) throw new Error('Exact reviewed final review hash required')
  const bodies = new Map(), receipts = []
  const add = (kind, file, bytes, extra = {}) => {
    if (bodies.has(file)) throw new Error('Duplicate evidence file')
    bodies.set(file, bytes); receipts.push({ kind, file, bytes: bytes.length, sha256: hash(bytes), ...extra })
  }
  add('release-manifest', 'evidence/release-manifest.json', releaseBytes)
  add('capture-manifest', 'evidence/capture-manifest.json', manifestBytes)
  add('capture-trial', 'evidence/capture-trial.json', read('aeries-full-native-002/trial.json'))
  add('frozen-trial', 'evidence/frozen-trial.json', read('frozen-trials/aeriestechnology.json'))
  add('code-attestation', 'evidence/code-attestation.json', read('aeries-reviewed-code-attestation-006.json'))
  add('independent-review', 'evidence/independent-review.json', reviewBytes)
  add('provider-identity', 'evidence/provider-identity.json', read('aeries-provider-current-009.json'))
  for (const row of manifest.packets) {
    const bytes = read('aeries-full-native-002/' + row.file)
    if (hash(bytes) !== row.sha256) throw new Error('Original native packet hash changed')
    add('native', 'evidence/native/' + row.file, bytes, { originFile: row.file })
  }
  for (const code of review.code) add('source-code', 'evidence/source/' + code.path, read(code.file), { sourcePath: code.path })
  const httpEvidence = { mode: 'reviewed-aeries-talentrecruit-exact-native-capture', receipts }, readEvidence = async file => bodies.get(file)
  const derived = await deriveAeriesPartialEvidence({ source: 'aeriestechnology', httpEvidence, readEvidence, now })
  const trial = { schemaVersion: 1, source: 'aeriestechnology', mode: 'native-http-partial-positive-trial', outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: derived.startedAt, completedAt: derived.capturedAt, httpEvidence, rawJobs: 24, indiaJobs: 24, globalTotal: 24, observedSelectedIndia: 22,
    inventoryEvidence: derived.inventoryEvidence, bindingEvidence: derived.bindingEvidence, detailHealth: derived.detailHealth,
    selectedDetailHealth: derived.selectedDetailHealth, filterCounts: derived.filterCounts, originalCapture: derived.originalCapture, jobs: derived.jobs }
  const bytes = Buffer.from(JSON.stringify(trial, null, 2) + '\n')
  const verified = await verifyAeriesPartialPublishingTrial({ trial, bytes, readEvidence, now })
  fs.mkdirSync(outputDirectory)
  for (const [relative, data] of bodies) {
    const target = path.join(outputDirectory, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data, { flag: 'wx' })
  }
  const file = path.join(outputDirectory, 'aeriestechnology.json'); fs.writeFileSync(file, bytes, { flag: 'wx' })
  const receipt = { source: trial.source, file, trialByteHash: verified.trialByteHash, productionWrites: false, rawTotal: 24, indiaTotal: 24, eligibleJobs: 22,
    inventoryComplete: false, detailHealth: derived.detailHealth, selectedDetailHealth: derived.selectedDetailHealth,
    attemptedAt: derived.startedAt, completedAt: derived.capturedAt, originalCapture: derived.originalCapture, frozenAt: now.toISOString() }
  fs.writeFileSync(path.join(outputDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
  const release = { schemaVersion: 1, mode: 'reviewed-aeries-partial-positive-manifest', productionWrites: false, inventoryComplete: false,
    sources: [{ source: trial.source, file: path.basename(file), trialByteHash: verified.trialByteHash, eligibleJobs: 22 }] }
  const manifestFile = path.join(outputDirectory, 'manifest.json'); fs.writeFileSync(manifestFile, JSON.stringify(release, null, 2) + '\n', { flag: 'wx' })
  return { ...receipt, manifestFile, manifestSha256: hash(fs.readFileSync(manifestFile)) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  if (!option('--archive') || !option('--output')) throw new Error('--archive and unused --output required')
  console.log(JSON.stringify(await freezeAeriesPartialTrial({ archiveDirectory: option('--archive'), outputDirectory: path.resolve(option('--output')) })))
}
