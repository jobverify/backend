import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const root = new URL('../scraper/colliers.workday/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'))
const receipts = manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, root)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return { ...receipt, body: body.toString('utf8') }
})
const BOARD = 'https://careers.colliers.com/jobs?options=705&page=1'
const first = receipts.find(row => row.requestedURL.includes('jid-3725'))
const schemaOf = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
const native = schemaOf(first.body)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'colliers')).run(options)
const replay = (t, mutate) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method || 'GET', 'GET')
    calls.push(url)
    const receipt = receipts.find(row => row.requestedURL === url)
    assert.ok(receipt, 'Uncaptured HTTP request: ' + url)
    const current = mutate ? mutate({ ...receipt }, calls) : receipt
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
const changeSchema = (receipt, edit) => ({ ...receipt,
  body: receipt.body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (_all, open, json, close) => { const value = JSON.parse(json); edit(value); return open + JSON.stringify(value) + close }) })

test('registered Colliers reads all three captured India pages and36 full native role records', async t => {
  const calls = replay(t)
  const jobs = await run()
  assert.equal(jobs.length, 36)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 36)
  const job = jobs.find(job => job.jobId === '3725')
  assert.equal(job.title, native.title)
  assert.equal(job.company, 'Colliers')
  assert.equal(job.sourceUrl, native.url)
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.location, 'Bengaluru, India')
  assert.equal(job.nativeSchemaDescription, native.description)
  assert.equal(job.nativePublicationDate, native.datePosted)
  assert.equal(job.postingDate, native.datePosted)
  assert.equal(job.closingDate, null)
  assert.equal(job.nativeFacts.nativeJobPosting.validThrough, native.validThrough)
  assert.equal(job.nativeFacts.nativeHiringOrganization.name, 'Colliers International')
  assert.equal(new URL(job.applyUrl).searchParams.get('vacancyId'), job.jobId)
  assert.ok(jobs.every(job => job.sourceDescription.length > 500 && job.country === 'India'
    && job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(jobs.some(job => job.title.includes('Business Analyst')))
  assert.ok(calls.includes(BOARD.replace('page=1', 'page=2')) && calls.includes(BOARD.replace('page=1', 'page=3')))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 36)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, true)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, true)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 0)
})

for (const changed of ['country', 'title', 'employer', 'role URL', 'publication date', 'hidden description', 'application identity',
  'foreign base', 'foreign base hidden', 'foreign base inert', 'foreign base style', 'visible closure']) {
  test('Colliers excludes a contradictory native ' + changed + ' while retaining other proven India roles', async t => {
    replay(t, receipt => {
      if (receipt.requestedURL !== first.requestedURL) return receipt
      if (changed.startsWith('foreign base')) {
        const extra = changed.endsWith('style') ? 'style="display:none"' : changed.slice('foreign base'.length).trim()
        return { ...receipt, body: receipt.body.replace(/<head\b[^>]*>/i, `$&<base ${extra} href="https://different-employer.example/">`) }
      }
      if (changed === 'visible closure') return { ...receipt, body: receipt.body.replace(/<\/h1>/i, '$&<p>This job is no longer available.</p>') }
      if (changed === 'hidden description') return { ...receipt, body: receipt.body.replace('aria-label="Job description"', 'aria-label="Job description" hidden') }
      if (changed === 'application identity') return { ...receipt, body: receipt.body.replaceAll('vacancyId=3725', 'vacancyId=3725&amp;vacancyId=9999') }
      return changeSchema(receipt, value => {
        if (changed === 'country') value.jobLocation[0].address.addressCountry = 'United States'
        if (changed === 'title') value.title = 'Other native role'
        if (changed === 'employer') value.hiringOrganization.name = 'Unrelated Employer'
        if (changed === 'role URL') value.url = 'https://careers.colliers.com/job/other-role-jid-9999'
        if (changed === 'publication date') value.datePosted = '2026-02-30T10:54:28+00:00'
      })
    })
    const jobs = await run()
    assert.equal(jobs.length, 35)
    assert.ok(!jobs.some(job => job.jobId === '3725'))
    assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false))
    assert.ok(jobs[0].nativeCollectionEvidence.failures.length > 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
}

test('Colliers retains an actual finite native deadline while ignoring the CMS hundred-year expiry placeholder', async t => {
  replay(t, receipt => receipt.requestedURL !== first.requestedURL ? receipt
    : changeSchema(receipt, value => { value.validThrough = '2026-11-29T10:54:28+00:00' }))
  const jobs = await run()
  assert.equal(jobs.find(job => job.jobId === '3725').closingDate, '2026-11-29T10:54:28+00:00')
})

test('Colliers cannot return a verified empty inventory when the current selected India list is unavailable', async t => {
  replay(t, receipt => receipt.requestedURL === BOARD ? { ...receipt, status: 403, body: 'Denied' } : receipt)
  await assert.rejects(run(), /incomplete|HTTP 403/)
})

for (const attributes of ['', 'hidden', 'inert', 'style="display:none"']) test('Colliers rejects a foreign document base before resolving relative roles: ' + (attributes || 'visible'), async t => {
  const calls = replay(t, receipt => receipt.requestedURL === BOARD
    ? { ...receipt, body: receipt.body.replace(/<head\b[^>]*>/i, `$&<base ${attributes} href="https://different-employer.example/">`) } : receipt)
  await assert.rejects(run(), /incomplete|base/)
  assert.deepEqual(calls, [BOARD])
})

test('Colliers ignores base-like data inside template content and raw scripts', async t => {
  replay(t, receipt => ({ ...receipt, body: receipt.body.replace(/<head\b[^>]*>/i,
    '$&<template><base href="https://different-employer.example/"></template><script>const example = "<base href=foreign>";</script>') }))
  assert.equal((await run()).length, 36)
})

test('Colliers retains earlier proven roles when native page2 loses its advertised pagination contract', async t => {
  replay(t, receipt => receipt.requestedURL.endsWith('page=2')
    ? { ...receipt, body: '<html><body>Colliers careers unavailable</body></html>' } : receipt)
  const jobs = await run()
  assert.equal(jobs.length, 12)
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('Colliers honors cancellation before any native HTTP request', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('cancel Colliers source'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Colliers source/)
})
