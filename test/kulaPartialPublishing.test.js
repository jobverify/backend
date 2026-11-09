import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { deriveKulaPartialEvidence, verifyKulaPartialPublishingTrial } from '../scripts/kulaPartialPublishingEvidence.js'
import { freezeKulaPartialTrial } from '../scripts/freezeKulaPartialTrial.js'

const now = new Date('2026-10-20T22:00:00Z')
const at = '2026-10-20T21:00:00Z'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const listingUrl = 'https://careers.kula.ai/acko?jobs=true'
const careersUrl = 'https://www.acko.com/careers/jobs/'
function fixture() {
  const row = { id: 1, account_id: 1339, title: 'Software Engineer', listed: true, kind: 'external', is_confidential: false,
    launch_at: '2026-10-01T00:00:00Z', end_at: null,
    ats_job: { job_description: '$a', employment_type: 'full_time',
      offices: [{ id: 1, country: 'India', country_code: 'IN', location: 'Bengaluru, Karnataka, India', name: 'Bengaluru' }] } }
  return { row, officialBody: `<iframe src="${listingUrl}"></iframe>`, description: '<p>Build reliable production software and maintain services.</p>', accountName: 'acko' }
}
function proofInput(f) {
  const source = f.accountName
  const nativeUrl = `https://careers.kula.ai/${source}?jobs=true`
  const officialUrl = source === 'avoma' ? 'https://www.avoma.com/careers' : careersUrl
  const text = `a:T${Buffer.byteLength(f.description).toString(16)},${f.description}`
  const model = `0:${JSON.stringify({ accountName: f.accountName, jobs: [f.row], departments: [], locations: [] })}\n`
  const html = (f.nativePrefix || '') + `<script>self.__next_f.push(${JSON.stringify([1, text + model])})</script>`
  const bodies = new Map()
  const receipt = (kind, url, body) => {
    const archive = { source, url, finalURL: url, startedAt: at, completedAt: at, status: 200, body, sha256: hash(Buffer.from(body)) }
    const bytes = Buffer.from(JSON.stringify(archive))
    const file = `${kind}.json`; bodies.set(file, bytes)
    return { kind, file, bytes: bytes.length, sha256: hash(bytes) }
  }
  const httpEvidence = { mode: 'direct-public-kula-html-capture', receipts: [receipt('official', officialUrl, f.officialBody), receipt('native', nativeUrl, html)] }
  return { source, httpEvidence, now, readEvidence: file => bodies.get(file) }
}

test('Avoma accepts only its officially linked native account and preserves unknown board completeness', async () => {
  const f = fixture()
  f.accountName = 'avoma'
  f.row.account_id = 1278
  f.officialBody = '<iframe src="https://careers.kula.ai/avoma?jobs=true"></iframe>'
  const proof = await deriveKulaPartialEvidence(proofInput(f))
  assert.equal(proof.rawTotal, 1)
  assert.equal(proof.jobs.length, 1)
  assert.equal(proof.jobs[0].company, 'Avoma')
  assert.equal(proof.jobs[0].companyDomain, 'avoma.com')
  assert.equal(proof.jobs[0].sourceListingComplete, false)
  assert.equal(proof.jobs[0].applyUrl, 'https://careers.kula.ai/avoma/1/?jobs=true')
  f.row.ats_job.offices[0].city = 'Seattle'
  await assert.rejects(deriveKulaPartialEvidence(proofInput(f)), /city|location/i)
  delete f.row.ats_job.offices[0].city
  f.row.account_id = 1339
  await assert.rejects(deriveKulaPartialEvidence(proofInput(f)), /account|employer/i)
})

test('Kula partial proof resolves native descriptions while retaining explicitly partial observed inventory', async () => {
  const input = proofInput(fixture())
  const proof = await deriveKulaPartialEvidence(input)
  assert.equal(proof.rawTotal, 1)
  assert.equal(proof.indiaTotal, 1)
  assert.equal(proof.jobs.length, 1)
  assert.equal(proof.jobs[0].sourceListingComplete, false)
  assert.equal(proof.detailHealth.complete, true)
  assert.match(proof.jobs[0].jobDescription, /Build reliable production software/)
  const trial = { schemaVersion: 1, source: 'acko', mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false, attemptedAt: at, completedAt: at,
    httpEvidence: input.httpEvidence, inventoryEvidence: { status: 'discovery-only', firstParty: true, listingComplete: false,
      surface: listingUrl, reportedTotal: null, observedRecords: 1, indiaFacetCount: 1, pagesFetched: 1, verifiedAt: at,
      reason: 'observed-kula-page-whole-board-completeness-unverified' }, jobs: proof.jobs }
  const entry = { ...input, trial, bytes: Buffer.from(JSON.stringify(trial)) }
  assert.equal((await verifyKulaPartialPublishingTrial(entry)).eligibleJobs, 1)
  trial.jobs[0].jobDescription = 'Invented replacement description'
  await assert.rejects(verifyKulaPartialPublishingTrial({ ...entry, bytes: Buffer.from(JSON.stringify(trial)) }), /Selected jobs differ/)
})

test('Kula evidence rejects private roles, tenant mismatches, unresolved geography, foreign conflicts and quoted pseudo links', async () => {
  for (const mutate of [
    f => { f.accountName = 'another' },
    f => { f.row.id = '../other-tenant' },
    f => { f.row.listed = false },
    f => { f.row.kind = 'internal' },
    f => { f.row.is_confidential = true },
    f => { f.row.launch_at = '2026-10-22T00:00:00Z' },
    f => { f.row.launch_at = ['2026-10-01T00:00:00Z'] },
    f => { f.row.end_at = ['2026-11-01T00:00:00Z'] },
    f => { f.row.ats_job.offices[0].country = ['India'] },
    f => { f.row.ats_job.offices[0].country = 'Unknown'; f.row.ats_job.offices[0].country_code = null; f.row.ats_job.offices[0].location = 'Unspecified' },
    f => { f.row.ats_job.offices[0].country_code = 'US' },
    f => { f.row.ats_job.offices[0].country = 'United States' },
    f => { f.officialBody = `<script>const link='${listingUrl}'</script>` },
    f => { f.officialBody = `<textarea><iframe src="${listingUrl}"></iframe></textarea>` },
    f => { f.officialBody = `<template><template></template><iframe src="${listingUrl}"></iframe></template>` },
    f => { f.officialBody = `<iframe src="https://example.com/"><iframe src="${listingUrl}"></iframe></iframe>` },
    f => { f.officialBody = `<div data-quoted='href="${listingUrl}"'></div>` },
  ]) {
    const f = fixture(); mutate(f)
    await assert.rejects(deriveKulaPartialEvidence(proofInput(f)))
  }
  const input = proofInput(fixture())
  input.httpEvidence.receipts[0].sha256 = '0'.repeat(64)
  await assert.rejects(deriveKulaPartialEvidence(input), /hash/)
})

test('Kula native expiry excludes closed roles instead of rewriting their closing timestamp', async () => {
  const f = fixture(); f.row.end_at = '2026-10-20T20:59:59Z'
  await assert.rejects(deriveKulaPartialEvidence(proofInput(f)), /No eligible/)
})

test('a comment containing a shadow jobs list cannot replace validated native description content', async () => {
  const f = fixture()
  const shadow = { ...f.row, ats_job: { ...f.row.ats_job, job_description: '<p>Injected replacement description from unrelated markup.</p>' } }
  f.nativePrefix = `<!-- ${JSON.stringify(JSON.stringify({ jobs: [shadow], departments: [] }))} -->`
  const proof = await deriveKulaPartialEvidence(proofInput(f))
  assert.ok(!proof.jobs[0].jobDescription.includes('Injected replacement'))
  assert.ok(proof.jobs[0].jobDescription.includes('Build reliable production software'))
})

test('Kula freezer keeps exact native archives and unknown board totals and refuses release reuse', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kula-partial-freezer-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const input = proofInput(fixture())
  const files = {}
  for (const receipt of input.httpEvidence.receipts) {
    files[receipt.kind] = path.join(directory, `${receipt.kind}.json`)
    fs.writeFileSync(files[receipt.kind], input.readEvidence(receipt.file))
  }
  const outputDirectory = path.join(directory, 'release')
  const options = { nativeFile: files.native, officialFile: files.official, outputDirectory, now }
  const receipt = await freezeKulaPartialTrial(options)
  const trial = JSON.parse(fs.readFileSync(receipt.file))
  assert.equal(trial.inventoryEvidence.reportedTotal, null)
  assert.equal(trial.inventoryEvidence.observedRecords, 1)
  assert.equal(trial.inventoryEvidence.listingComplete, false)
  assert.ok(fs.readFileSync(path.join(outputDirectory, 'evidence/native.json')).equals(fs.readFileSync(files.native)))
  assert.equal(hash(fs.readFileSync(receipt.file)), receipt.trialByteHash)
  await assert.rejects(freezeKulaPartialTrial(options), /EEXIST/)
})
