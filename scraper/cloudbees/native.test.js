import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CAREERS, FEED, BOARD, readPaylocityPageData, runNativeCloudBees, verifyCloudBeesOfficial } from './native.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/current-20261029')
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(path.join(fixtureDir, receipt.filename)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.url, { ...receipt, body, bodyComplete: true }]
}))
const feed = JSON.parse(records.get(FEED).body.toString())
const board = readPaylocityPageData(records.get(BOARD).body.toString())
const transport = override => async (url, { signal }) => {
  signal?.throwIfAborted()
  assert.ok(records.has(url), `Uncaptured URL must not be fetched: ${url}`)
  const response = structuredClone(records.get(url))
  return override ? override(response, url) : response
}
const replaceBody = (response, edit) => ({ ...response, body: Buffer.from(edit(Buffer.from(response.body).toString())) })
const replaceFeed = (response, edit) => replaceBody(response, body => { const data = JSON.parse(body); edit(data); return JSON.stringify(data) })
const failure = pattern => error => Boolean(error.nativeEvidence?.failures.some(row => pattern.test(row.message)))

test('captured native feed reconciles 42 board identities and six explicit India candidates', () => {
  assert.equal(feed.jobs.length, 42)
  assert.equal(board.Jobs.length, 42)
  assert.equal(board.Jobs.filter(row => row.JobLocation.Country === 'IND').length, 6)
  verifyCloudBeesOfficial(records.get(CAREERS).body.toString())
})

test('production catalog returns five Chennai jobs with complete native feed descriptions and original posting dates', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'cloudbees')
  assert.equal(provider.atsPlatform, 'paylocity')
  assert.equal(provider.backfillMode, 'live-parser')
  const jobs = await createCatalogScraper(provider).run({ transport: transport() })
  assert.deepEqual(jobs.map(job => job.jobId), ['4380781', '4591748', '4566665', '4424186', '4275275'])
  for (const job of jobs) {
    const native = feed.jobs.find(row => String(row.jobId) === job.jobId)
    assert.equal(job.company, 'CloudBees')
    assert.equal(job.source, 'cloudbees')
    assert.equal(job.country, 'India')
    assert.equal(job.city, 'Chennai')
    assert.equal(job.sourceDescription, native.description + (native.requirements ? `<h3>Requirements</h3>${native.requirements}` : ''))
    assert.equal(job.jobDescription, job.sourceDescription)
    assert.equal(job.postingDate, native.publishedDate)
    assert.equal(job.nativeFacts.nativeCreatedUtc, native.createdUtc)
    assert.equal(job.nativeFeedDescriptionHTML, native.description)
    assert.equal(job.nativeFeedRequirementsHTML, native.requirements)
    assert.equal(job.applyUrl, native.applyUrl)
    assert.equal(job.nativeDescriptionOrigin, 'employer-native-public-Paylocity-feed-description-and-requirements')
    assert.equal(job.nativeFacts.visibleContentVerified, false)
    assert.equal(job.nativeVisibleDescriptionHTML, undefined)
    assert.equal(job.nativeFacts.nativeVisibleDescriptionHTML, undefined)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(jobs.find(job => job.jobId === '4275275').postingDate, '2026-06-23T14:56:23Z')
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
  assert.match(jobs[0].nativeCollectionEvidence.failures[0].message, /location scope unresolved/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('a quoted feed URL or inert script cannot establish the current employer binding', () => {
  const original = records.get(CAREERS).body.toString()
  for (const html of [original.replace("const API_URL =", 'const OLD_URL ='),
    original.replace("fetch(API_URL)", 'fetch(OLD_URL)'),
    '<script type="application/json">' + JSON.stringify(FEED) + '</script><div data-job-list></div>']) {
    assert.notEqual(html, original)
    assert.throws(() => verifyCloudBeesOfficial(html), /binding changed/)
  }
})

test('native employer, full inventory, public application identity and publication date must reconcile', async () => {
  const mutations = [
    data => { data.displayName = 'Unrelated Employer' },
    data => { data.jobs.pop() },
    data => { data.jobs[0].companyName = 'Unrelated Employer' },
    data => { data.jobs[0].applyUrl = data.jobs[1].applyUrl },
    data => { data.jobs[0].publishedDate = '2026-10-01T00:00:00Z' },
    data => { data.jobs[0] = data.jobs[1] },
  ]
  for (const mutate of mutations) {
    await assert.rejects(runNativeCloudBees({ transport: transport((response, url) => url === FEED ? replaceFeed(response, mutate) : response) }),
      failure(/native feed|role identity|publication dates/))
  }
})

test('internal or foreign-country roles cannot inherit India/public scope from another record', async () => {
  const changed = await runNativeCloudBees({ transport: transport((response, url) => url === BOARD ? replaceBody(response, body => {
    const data = readPaylocityPageData(body)
    data.Jobs.find(row => row.JobId === 4380781).IsInternal = true
    data.Jobs.find(row => row.JobId === 4591748).JobLocation.Country = 'USA'
    return body.replace(/window\.pageData\s*=\s*[^]*?;\s*<\/script>/, `window.pageData = ${JSON.stringify(data)};</script>`)
  }) : response) })
  assert.deepEqual(changed.map(job => job.jobId), ['4566665', '4424186', '4275275'])
})

test('one mismatched public role page preserves other validated jobs and records the failure', async () => {
  const target = feed.jobs.find(row => row.jobId === 4380781).displayUrl
  const jobs = await runNativeCloudBees({ transport: transport((response, url) => url === target
    ? replaceBody(response, html => html.replaceAll('Software Engineer - Java', 'Different Role')) : response) })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.jobId !== '4380781'))
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 2)
})

test('a changed closing native feed remains a partial check', async () => {
  let reads = 0
  const jobs = await runNativeCloudBees({ transport: transport((response, url) => url === FEED && ++reads === 2
    ? replaceFeed(response, data => { data.jobs[0].description += '<p>Changed during collection.</p>' }) : response) })
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, false)
  assert.ok(jobs[0].nativeCollectionEvidence.failures.some(row => row.stage === 'closing-inventory'))
})

test('native JSON requests negotiate JSON while HTML keeps its normal Accept header', async () => {
  const seen = []
  const request = createHTMLTransport({ validateURL() {}, expectedContentType: url => url === FEED ? 'application/json' : 'text/html' }, {
    fetchImpl: async (url, options) => {
      seen.push([url, options.headers.Accept])
      const response = new Response('complete native body', { status: 200 })
      Object.defineProperty(response, 'url', { value: url })
      return response
    },
  })
  await request(FEED)
  await request(CAREERS)
  assert.deepEqual(seen, [[FEED, 'application/json'], [CAREERS, 'text/html']])
})

test('pre-cancelled native source work makes no requests', async () => {
  const controller = new AbortController()
  controller.abort(Error('cancel source'))
  await assert.rejects(runNativeCloudBees({ signal: controller.signal, transport: async () => assert.fail('No cancelled request') }), /cancel source/)
})
