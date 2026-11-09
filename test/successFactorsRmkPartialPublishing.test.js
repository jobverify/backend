import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { deriveSuccessFactorsRmkPartialEvidence, verifySuccessFactorsRmkPartialPublishingTrial } from '../scripts/successFactorsRmkPartialPublishingEvidence.js'
import { freezeSuccessFactorsRmkPartialTrial } from '../scripts/freezeSuccessFactorsRmkPartialTrial.js'

const now = new Date('2026-10-20T21:00:00.000Z')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture(source = 'astellaspharma', healthy = false) {
  const origin = 'https://careers.astellas.com'
  const bytes = fs.readFileSync(new URL('./fixtures/successFactorsRmk/discovery/batch-007.json', import.meta.url))
  const batch = JSON.parse(bytes), record = batch.records.find(row => row.source === source)
  const bodies = new Map([['discovery.json', bytes]])
  const receipts = [{ kind: 'discovery', file: 'discovery.json', bytes: bytes.length, sha256: hash(bytes) }]
  for (const proofPath of record.proofFiles) {
    const body = fs.readFileSync(new URL(`./fixtures/successFactorsRmk/discovery/${proofPath}`, import.meta.url))
    bodies.set(proofPath, body); receipts.push({ kind: 'discovery-proof', proofPath, file: proofPath, bytes: body.length, sha256: hash(body) })
  }
  const token = `<script>var x={"ssoCompanyId":"astellasT5"}</script>`
  const listing = token + '<span class="paginationLabel">Results <b>1 – 3</b> of <b>3</b></span><table>' + ['101', '102', '103'].map(id => `<tr class="data-row"><td><a class="jobTitle-link" href="/job/Engineer/${id}/">Engineer</a><span class="jobLocation">${id === '103' ? 'Boston, MA, US' : 'Mumbai, MH, IN'}</span></td></tr>`).join('') + '</table>'
  const detail = id => token + `<h1 itemprop="title">Engineer</h1><meta itemprop="hiringOrganization" content="Astellas"><span class="jobGeoLocation">Mumbai, MH, IN</span><meta itemprop="addressCountry" content="IN"><span itemprop="description">${id === '101' || healthy ? '<p>Build and operate production software services.</p>' : ''}</span><a href="/talentcommunity/apply/${id}/">Apply</a>`
  const add = (file, requestedURL, body) => {
    const packet = { source, method: 'GET', requestedURL, finalURL: requestedURL, status: 200, contentType: 'text/html', startedAt: '2026-10-20T20:00:00.000Z', completedAt: '2026-10-20T20:00:01.000Z', body, bodySha256: hash(Buffer.from(body)) }
    const bytes = Buffer.from(JSON.stringify(packet)); bodies.set(file, bytes); receipts.push({ kind: 'native', file, bytes: bytes.length, sha256: hash(bytes) })
  }
  add('listing.json', `${origin}/search?locale=en_GB`, listing)
  add('101.json', `${origin}/job/Engineer/101/`, detail('101'))
  add('102.json', `${origin}/job/Engineer/102/`, detail('102'))
  const httpEvidence = { mode: 'direct-first-party-rmk-http-capture', receipts }
  const readEvidence = async file => bodies.get(file)
  const mutate = (file, change) => { const packet = JSON.parse(bodies.get(file)); change(packet); packet.bodySha256 = hash(Buffer.from(packet.body)); const bytes = Buffer.from(JSON.stringify(packet)); bodies.set(file, bytes); Object.assign(receipts.find(r => r.file === file), { bytes: bytes.length, sha256: hash(bytes) }) }
  return { source, httpEvidence, readEvidence, bodies, mutate }
}
async function trialFor(f) {
  const proof = await deriveSuccessFactorsRmkPartialEvidence({ ...f, now })
  const trial = { schemaVersion: 1, source: f.source, mode: 'native-http-partial-positive-trial', outcome: 'positive-extraction-incomplete-evidence', productionWrites: false, attemptedAt: proof.startedAt, completedAt: proof.capturedAt, httpEvidence: f.httpEvidence, inventoryEvidence: proof.inventoryEvidence, observedSurfaceEvidence: proof.observedSurfaceEvidence, bindingEvidence: proof.bindingEvidence, detailHealth: proof.detailHealth, filterCounts: proof.filterCounts, jobs: proof.jobs }
  return { trial, bytes: Buffer.from(JSON.stringify(trial)), readEvidence: f.readEvidence, now }
}

test('RMK partial proof replays every actual packet and selects all eligible India content', async () => {
  const f = fixture(), proof = await deriveSuccessFactorsRmkPartialEvidence({ ...f, now })
  assert.equal(proof.rawTotal, 3); assert.equal(proof.indiaTotal, 2); assert.equal(proof.jobs.length, 2)
  assert.equal(proof.detailHealth.missingDescriptions, 1)
  assert.equal(proof.inventoryEvidence.listingComplete, false)
  assert.equal(proof.observedSurfaceEvidence.listingComplete, true)
  assert.equal(proof.jobs[0].sourceListingComplete, false)
  assert.equal((await verifySuccessFactorsRmkPartialPublishingTrial(await trialFor(f))).eligibleJobs, 2)
})

test('Astellas healthy observed roles remain partial because separate employer scope is unresolved', async () => {
  const f = fixture('astellaspharma', true), proof = await deriveSuccessFactorsRmkPartialEvidence({ ...f, now })
  assert.equal(proof.jobs.length, 2)
  assert.equal(proof.detailHealth.missingDescriptions, 0)
  assert.equal(proof.detailHealth.complete, false)
  assert.equal(proof.observedSurfaceEvidence.employerScopeComplete, false)
  assert.equal(proof.inventoryEvidence.status, 'coverage-gap')
  assert.ok(proof.jobs.every(job => job.sourceListingComplete === false))
})

test('wrong native source, host, tenant, company, title, ID, country and response hashes fail closed', async () => {
  for (const change of [
    p => { p.source = 'other' }, p => { p.finalURL = p.finalURL.replace('careers.astellas.com', 'evil.example') },
    p => { p.body = p.body.replace('astellasT5', 'wrong') }, p => { p.body = p.body.replace('Astellas', 'Other Company') },
    p => { p.body = p.body.replace('>Engineer<', '>Manager<') }, p => { p.body = p.body.replace('/apply/101/', '/apply/999/') },
    p => { p.body = p.body.replace('Mumbai, MH, IN', 'Boston, MA, US') }, p => { p.status = 403 },
    p => { p.completedAt = '2026-10-01T00:00:00.000Z' },
  ]) { const f = fixture(); f.mutate('101.json', change); await assert.rejects(deriveSuccessFactorsRmkPartialEvidence({ ...f, now })) }
  const f = fixture(); f.bodies.set('101.json', Buffer.from('changed')); await assert.rejects(deriveSuccessFactorsRmkPartialEvidence({ ...f, now }), /hash|bytes/i)
})

test('missing/unused packets, mismatched totals, duplicate IDs and absent discovery proof reject', async () => {
  for (const change of [
    f => f.httpEvidence.receipts.pop(),
    f => f.httpEvidence.receipts.push({ ...f.httpEvidence.receipts.at(-1) }),
    f => f.mutate('listing.json', p => { p.body = p.body.replace('of <b>3', 'of <b>4') }),
    f => f.mutate('listing.json', p => { p.body = p.body.replaceAll('/102/', '/101/') }),
    f => f.httpEvidence.receipts.splice(0, 1),
    f => { f.httpEvidence.receipts = f.httpEvidence.receipts.filter(r => r.kind !== 'discovery-proof') },
  ]) { const f = fixture(); change(f); await assert.rejects(deriveSuccessFactorsRmkPartialEvidence({ ...f, now })) }
})

test('partial trial cannot truncate jobs, alter source content, claim complete health or manufacture empty detail', async () => {
  for (const change of [
    t => { t.jobs = [] }, t => { t.maxJobs = 1 }, t => { t.jobs[0].jobDescription = 'Invented description' },
    t => { t.jobs[0].sourceListingComplete = true }, t => { t.inventoryEvidence.listingComplete = true },
    t => { t.detailHealth.complete = true }, t => { t.jobs[0].country = 'United States' },
  ]) { const args = await trialFor(fixture()); change(args.trial); args.bytes = Buffer.from(JSON.stringify(args.trial)); await assert.rejects(verifySuccessFactorsRmkPartialPublishingTrial(args)) }
})

test('offline freezer copies exact evidence bytes and refuses existing releases and escaped packets', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmk-partial-'))
  t.after(() => { assert.ok(path.basename(dir).startsWith('rmk-partial-')); fs.rmSync(dir, { recursive: true, force: true }) })
  const f = fixture(), nativeDir = path.join(dir, 'native')
  fs.mkdirSync(nativeDir)
  const packets = f.httpEvidence.receipts.filter(row => row.kind === 'native').map(receipt => {
    const bytes = f.bodies.get(receipt.file), packet = JSON.parse(bytes)
    fs.writeFileSync(path.join(nativeDir, receipt.file), bytes)
    return { file: receipt.file, sha256: hash(bytes), bodySha256: packet.bodySha256, requestedURL: packet.requestedURL, status: packet.status }
  })
  const nativeManifestFile = path.join(nativeDir, 'manifest.json')
  fs.writeFileSync(nativeManifestFile, JSON.stringify({ source: f.source, packets }))
  const options = { nativeManifestFile, discoveryFile: new URL('./fixtures/successFactorsRmk/discovery/batch-007.json', import.meta.url), outputDirectory: path.join(dir, 'release'), now }
  const receipt = await freezeSuccessFactorsRmkPartialTrial(options)
  const bytes = fs.readFileSync(receipt.file), trial = JSON.parse(bytes)
  const readEvidence = async file => fs.readFileSync(path.join(options.outputDirectory, file))
  assert.equal((await verifySuccessFactorsRmkPartialPublishingTrial({ trial, bytes, readEvidence, now })).eligibleJobs, 2)
  await assert.rejects(freezeSuccessFactorsRmkPartialTrial(options), /exist/i)
  fs.writeFileSync(path.join(dir, 'outside.json'), f.bodies.get('101.json'))
  packets[1].file = '../outside.json'
  fs.writeFileSync(nativeManifestFile, JSON.stringify({ source: f.source, packets }))
  await assert.rejects(freezeSuccessFactorsRmkPartialTrial({ ...options, outputDirectory: path.join(dir, 'escaped') }), /escapes/)
  assert.equal(fs.existsSync(path.join(dir, 'escaped')), false)
})
