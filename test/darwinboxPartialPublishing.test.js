import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js'
import { verifyPartialPublishingTrial, buildPartialAttempt, loadPartialTrial, executePartialPublishingRollout } from '../scripts/partialPublishingGapEvidence.js'
import { freezeDarwinboxPartialTrial } from '../scripts/freezeDarwinboxPartialTrial.js'

const now = new Date('2026-10-21T00:00:00Z')
const at = '2026-10-20T23:00:00Z'
const origin = 'https://mindsprint.darwinbox.in'
const companyId = 'a671608963ef6d'
const listing = `${origin}/ms/candidateapi/job/alljobs?companyId=${companyId}`
const hash = b => createHash('sha256').update(b).digest('hex')
const record = (id, jd) => ({ id, title: 'Software Engineer ' + id, country: 'India',
  locations: 'Chennai, Tamil Nadu, India', officelocation_arr: ['office1'],
  officelocations_area: ['Chennai, Tamil Nadu, India'], jd })

function fixture() {
  const records = [record('a1', '<p>Build reliable software services.</p>'), record('a2', '')]
  const archive = { source: 'mindsprint', mode: 'browser-public-native-http-capture', productionWrites: false,
    capturedAt: at, reportedTotal: 2, entries: [
      { request: { url: listing, method: 'POST', body: JSON.stringify({ companyId, sort_option: 'new', limit: 10, page: 1 }) },
        response: { status: 200, body: JSON.stringify({ status: 'success', job_counts: 2, data: records }) } },
      { request: { url: `${origin}/ms/candidateapi/job/a2?companyId=${companyId}`, method: 'GET' },
        response: { status: 200, body: JSON.stringify({ status: 'success', message: { job: [{ ...records[1],
          officelocation_show_arr: records[1].locations, officelocation_show_arr_list: [records[1].locations] }] } }) } },
    ] }
  const careersUrl = 'https://www.mindsprint.com/'
  const handoffUrl = `${origin}/ms/candidate/careers`
  const parser = createDarwinboxScraper({ source: 'mindsprint', companyName: 'Mindsprint', origin, companyId })
  const job = { ...parser.extractSearchResults({ data: [records[0]] })[0], source: 'mindsprint', country: 'India',
    companyDomain: 'mindsprint.com', companyCareerPage: careersUrl, scrapedAt: at,
    sourceListingComplete: false, sourceDetailComplete: true }
  job.link = job.sourceUrl
  const trial = { schemaVersion: 1, source: 'mindsprint', mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false, attemptedAt: at, completedAt: at,
    bindingEvidence: { source: 'mindsprint', companyName: 'Mindsprint', companyDomain: 'mindsprint.com', careersUrl,
      origin, companyId, handoffUrl, listingUrl: listing, verifiedAt: at },
    inventoryEvidence: { status: 'discovery-only', firstParty: true, listingComplete: false, surface: listing,
      reportedTotal: 2, indiaFacetCount: 2, pagesFetched: 1, verifiedAt: at, reason: 'native-detail-incomplete' },
    publicListingProof: { fullResponse: true, rawTotal: 2, publicTotal: 2, indiaTotal: 2, pagesFetched: 1,
      terminalReason: 'stable-total-reconciled' }, jobs: [job] }
  return refresh({ trial, archive, official: { url: careersUrl, finalUrl: careersUrl, status: 200, fetchedAt: at,
    body: `<a href="${handoffUrl}">Careers</a>` }, now })
}

function refresh(f) {
  const bodies = new Map(); const receipts = []
  const put = (file, value) => { const bytes = Buffer.from(value); bodies.set(file, bytes); return { file, bytes: bytes.length, sha256: hash(bytes) } }
  const archive = put('archive.json', JSON.stringify(f.archive))
  receipts.push({ kind: 'official-binding', ...f.official, ...put('official.body', f.official.body) })
  delete receipts[0].body
  f.archive.entries.forEach((entry, packetIndex) => receipts.push({ kind: 'native', packetIndex,
    url: entry.request.url, method: entry.request.method, requestBody: entry.request.body ?? null,
    requestBodySha256: hash(entry.request.body || ''), status: entry.response.status, fetchedAt: f.archive.capturedAt,
    ...put(`native-${packetIndex}.body`, entry.response.body) }))
  f.trial.httpEvidence = { mode: 'browser-public-native-http-capture', archive, receipts }
  return { ...f, bytes: Buffer.from(JSON.stringify(f.trial)), readEvidence: file => bodies.get(file), bodies }
}

test('Darwinbox partial gate verifies full native inventory and genuinely empty detail while retaining all eligible roles', async () => {
  const proof = await verifyPartialPublishingTrial(fixture())
  assert.equal(proof.eligibleJobs, 1)
  assert.equal(proof.rawTotal, 2)
  assert.equal(proof.publicTotal, 2)
  assert.equal(proof.detailHealth.complete, false)
  assert.equal(proof.detailHealth.missingDescriptions, 1)
  const attempt = buildPartialAttempt(proof, { inserted: 1, updated: 0, deleted: 0, missed: 0, expired: 0 }, now)
  assert.equal(attempt.success, false)
  assert.equal(attempt.inventoryEvidence.listingComplete, false)
})

test('Darwinbox partial gate rejects altered identity, scope, bodies, pagination and truncated selections', async () => {
  const mutateListing = (f, mutate) => { const entry = f.archive.entries[0]; const body = JSON.parse(entry.response.body); mutate(body); entry.response.body = JSON.stringify(body) }
  const mutateDetail = (f, mutate) => { const entry = f.archive.entries[1]; const body = JSON.parse(entry.response.body); mutate(body); entry.response.body = JSON.stringify(body) }
  for (const mutate of [
    f => { f.trial.source = 'shoppersstop' },
    f => { f.trial.bindingEvidence.companyId = 'other' },
    f => { f.trial.bindingEvidence.origin = 'https://other.darwinbox.in' },
    f => { f.official.body = '<a href="https://other.darwinbox.in/ms/candidate/careers">Jobs</a>' },
    f => { f.archive.capturedAt = '2026-01-01T00:00:00Z' },
    f => { f.archive.entries[0].response.status = 403 },
    f => { f.archive.entries[0].request.body = JSON.stringify({ companyId, sort_option: 'new', limit: 10, page: 2 }) },
    f => { f.archive.entries[0].request.body = JSON.stringify({ companyId, sort_option: 'new', limit: 10, page: 1, country: 'India' }) },
    f => mutateListing(f, b => { b.job_counts = 3 }),
    f => mutateListing(f, b => { b.data[1].id = b.data[0].id }),
    f => mutateListing(f, b => { b.data[0].country = 'United States' }),
    f => mutateDetail(f, b => { b.message.job[0].id = 'other' }),
    f => mutateDetail(f, b => { b.message.job[0].title = 'Other title' }),
    f => mutateDetail(f, b => { b.message.job[0].officelocation_arr = ['other-office'] }),
    f => mutateDetail(f, b => { b.message.job[0].country = 'United States' }),
    f => mutateDetail(f, b => { b.message.job[0].jd = '<p>A second real role description.</p>' }),
    f => { f.archive.entries.pop() },
    f => { f.trial.jobs[0].jobDescription = 'Invented description' },
    f => { f.trial.jobs[0].location = 'Delhi, India' },
    f => { f.trial.jobs[0].sourceListingComplete = true },
    f => { f.trial.jobs = [] },
    f => { f.trial.maxJobs = 1 },
  ]) { const f = fixture(); mutate(f); await assert.rejects(verifyPartialPublishingTrial(refresh(f))) }
  const f = fixture(); f.bodies.set('native-0.body', Buffer.from('altered'))
  await assert.rejects(verifyPartialPublishingTrial(f), /hash|bytes/i)
})

test('captured unavailable detail is partial upstream health rather than an empty source', async () => {
  const f = fixture(); f.archive.entries[1].response = { status: 503, body: 'Service unavailable' }
  const proof = await verifyPartialPublishingTrial(refresh(f))
  assert.equal(proof.eligibleJobs, 1)
  assert.equal(proof.detailHealth.complete, false)
  assert.equal(proof.detailHealth.failureKinds.upstream, 1)
})

test('native blank listing display separators do not erase explicit country and address evidence', async () => {
  const f = fixture(); const e = f.archive.entries[0]; const b = JSON.parse(e.response.body)
  b.data[0].officelocation_show_arr_list = ['', ' Chennai, Tamil Nadu, India ', '']
  b.data[0].officelocation_arr = ['', 'office1']
  e.response.body = JSON.stringify(b)
  assert.equal((await verifyPartialPublishingTrial(refresh(f))).eligibleJobs, 1)
})

test('grouped native details require all actual India addresses and exact listing office IDs', async () => {
  const f = fixture(); const e = f.archive.entries[1]; const b = JSON.parse(e.response.body)
  b.message.job[0].officelocation_show_arr = 'Multiple locations'
  b.message.job[0].officelocation_show_arr_list = ['Multiple locations']
  b.message.job[0].tool_tip_locations = ['Chennai, Tamil Nadu, India']
  e.response.body = JSON.stringify(b)
  assert.equal((await verifyPartialPublishingTrial(refresh(f))).eligibleJobs, 1)
  b.message.job[0].tool_tip_locations = ['New York, United States']
  e.response.body = JSON.stringify(b)
  await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /location|India|country/i)
})

test('multi-page native listing must reconcile stable total with every page, no duplicates or truncation', async () => {
  const make = () => {
    const f = fixture(); const first = f.archive.entries[0]; const b = JSON.parse(first.response.body)
    first.request.body = JSON.stringify({ companyId, sort_option: 'new', limit: 1, page: 1 })
    first.response.body = JSON.stringify({ ...b, data: [b.data[0]] })
    f.archive.entries.splice(1, 0, { request: { ...first.request, body: JSON.stringify({ companyId, sort_option: 'new', limit: 1, page: 2 }) },
      response: { status: 200, body: JSON.stringify({ ...b, data: [b.data[1]] }) } })
    f.trial.publicListingProof.pagesFetched = f.trial.inventoryEvidence.pagesFetched = 2
    return f
  }
  assert.equal((await verifyPartialPublishingTrial(refresh(make()))).eligibleJobs, 1)
  for (const mutate of [
    f => f.archive.entries.splice(1, 1),
    f => { const b = JSON.parse(f.archive.entries[1].response.body); b.job_counts = 3; f.archive.entries[1].response.body = JSON.stringify(b) },
    f => { f.archive.entries[1].response.body = f.archive.entries[0].response.body },
    f => { f.archive.entries.reverse() },
  ]) { const f = make(); mutate(f); await assert.rejects(verifyPartialPublishingTrial(refresh(f))) }
})

test('offline freezer preserves exact capture bytes and rejects overwriting an immutable release', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'darwinbox-partial-'))
  try {
    const f = fixture(); const captureFile = path.join(directory, 'capture.json'); const officialFile = path.join(directory, 'official.json')
    const captureBytes = Buffer.from(JSON.stringify(f.archive, null, 1) + '\n')
    fs.writeFileSync(captureFile, captureBytes)
    fs.writeFileSync(officialFile, JSON.stringify({ source: 'mindsprint', requestedURL: f.official.url,
      finalURL: f.official.finalUrl, completedAt: at, status: 200, body: f.official.body }))
    const options = { captureFile, officialFile, outputDirectory: path.join(directory, 'release'), now }
    const result = await freezeDarwinboxPartialTrial(options)
    assert.equal(result.eligibleJobs, 1)
    assert.ok(fs.readFileSync(path.join(options.outputDirectory, 'evidence/native-archive.json')).equals(captureBytes))
    const proof = await verifyPartialPublishingTrial({ ...loadPartialTrial(result.trialFile), now })
    assert.equal(proof.trialByteHash, result.trialByteHash)
    await assert.rejects(freezeDarwinboxPartialTrial(options), /exist/i)
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('an exact native closing instant earlier today is already ineligible for public publication', async () => {
  const f = fixture(); f.now = new Date('2026-10-21T12:00:00Z')
  const closingDate = '2026-10-21T11:00:00.000Z'
  const e = f.archive.entries[0]; const b = JSON.parse(e.response.body)
  b.data[0].job_posting = { careers: { to: Date.parse(closingDate) / 1000 } }
  e.response.body = JSON.stringify(b); f.trial.jobs[0].closingDate = closingDate
  f.trial.jobs[0].sourceClosingDateIsExact = true
  await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /eligible/i)
})

test('Darwinbox execution uses no-cleanup options and records partial health with separate India counts', async () => {
  const entry = fixture(); const validation = { environment: 'temporary-local-mongodb', productionWrites: false,
    generatedAt: at, passedSources: 1, siteSettings: { experiencedJobsEnabled: true }, rows: [{ source: 'mindsprint',
      trialByteHash: hash(entry.bytes), outcome: 'passed', eligibleJobs: 1, visibleJobs: 1,
      idempotent: true, priorJobsPreserved: true, partialStatusPreserved: true }] }
  let attempt
  const result = await executePartialPublishingRollout({ entries: [entry], validation, now,
    collectSnapshot: async () => ({ databaseAvailable: true, statuses: [{ source: 'mindsprint', isActive: true }],
      inventory: [], publicCompanyNames: ['Mindsprint'], siteSettings: validation.siteSettings }),
    saveJobs: async (_jobs, source, options) => {
      assert.equal(source, 'mindsprint'); assert.equal(options.replaceExisting, false)
      assert.equal(options.enqueueAlerts, false); assert.equal(options.descriptionRewriteMode, 'off')
      return { inserted: 1, updated: 0, deleted: 0, missed: 0, expired: 0 }
    }, recordPartialStatus: async (_source, value) => { attempt = value },
    verifyVisibility: async () => 1, checkpoint: async () => {},
  })
  assert.equal(result.completed, true)
  assert.equal(attempt.success, false)
  assert.equal(attempt.detailHealth.complete, false)
  assert.equal(attempt.inventoryEvidence.listingComplete, false)
  assert.equal(buildPartialAttempt({ rawTotal: 50, publicTotal: 50, indiaTotal: 43, eligibleJobs: 40,
    trial: entry.trial, filterCounts: {}, detailHealth: {} }, {}, now).jobs, 43)
})

test('rendered corporate handoff is distinct hashed DOM evidence with successful same-origin navigation', async () => {
  const f = fixture()
  const dom = { source: 'mindsprint', mode: 'rendered-official-page-dom', bodyKind: 'rendered-footer-subtree',
    requestedURL: f.official.url, finalURL: f.official.finalUrl, status: 200, navigationStatus: 200,
    completedAt: at, body: f.official.body }
  const bytes = Buffer.from(JSON.stringify(dom)); f.bodies.set('dom.json', bytes)
  f.trial.httpEvidence.officialArchive = { file: 'dom.json', bytes: bytes.length, sha256: hash(bytes) }
  Object.assign(f.trial.httpEvidence.receipts[0], { kind: 'official-binding-dom', mode: dom.mode,
    navigationStatus: 200, bodyKind: dom.bodyKind })
  f.bytes = Buffer.from(JSON.stringify(f.trial))
  assert.equal((await verifyPartialPublishingTrial(f)).eligibleJobs, 1)
  f.trial.httpEvidence.receipts[0].navigationStatus = 403; f.bytes = Buffer.from(JSON.stringify(f.trial))
  await assert.rejects(verifyPartialPublishingTrial(f), /DOM|navigation/i)
})

test('an ATS URL inside quoted data, script or comment text is not a corporate navigation link', async () => {
  for (const html of [
    `<a data-note=' href="${origin}/ms/candidate/careers"'>Not a link</a>`,
    `<a src="${origin}/ms/candidate/careers">Invalid anchor</a>`,
    `<script>const text='<a href="${origin}/ms/candidate/careers">Jobs</a>'</script>`,
    `<!-- <a href="${origin}/ms/candidate/careers">Jobs</a> -->`,
  ]) { const f = fixture(); f.official.body = html; await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /handoff/i) }
})

test('malformed country values and unknown native geography cannot be erased or counted foreign', async () => {
  for (const country of [['United States'], { name: 'India' }, 123]) {
    const f = fixture(); const e = f.archive.entries[0]; const b = JSON.parse(e.response.body)
    b.data[0].country = country; e.response.body = JSON.stringify(b)
    await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /country/i)
  }
  for (const country of ['Unknown', 'N/A', 'Unspecified', 'ZZ', 'Unknown Region']) {
    const f = fixture(); const e = f.archive.entries[0]; const b = JSON.parse(e.response.body)
    b.data[1] = { id: 'a2', title: 'Software Engineer a2', country, locations: 'Unspecified office', jd: '' }
    e.response.body = JSON.stringify(b)
    f.trial.inventoryEvidence.indiaFacetCount = f.trial.publicListingProof.indiaTotal = 1
    await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /country|scope/i)
  }
})

test('inactive raw text and nested templates cannot establish a Darwinbox corporate handoff', async () => {
  for (const wrap of [
    value => `<textarea>${value}</textarea>`,
    value => `<template><template></template>${value}</template>`,
    value => `<iframe src="https://example.com/">${value}</iframe>`,
  ]) {
    const f = fixture()
    f.official.body = wrap(f.official.body)
    await assert.rejects(verifyPartialPublishingTrial(refresh(f)), /Corporate body/)
  }
})

export { fixture, refresh, now }
