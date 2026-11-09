import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createSocGenScraper, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('../societegenerale/test-data/full-native-20261105.json.gz', import.meta.url))))
const pages = new Map(captured.entries.map(entry => [entry.url, entry]))
const reader = async url => {
  const entry = pages.get(url)
  assert.ok(entry, `Uncaptured native URL: ${url}`)
  return { status:entry.status, url:entry.url, html:entry.body }
}

test('SocGen preserves genuine native coverage gaps while labeling every delegated role with the alias', async () => {
  // Break caught: Array.map silently drops the child inventory evidence.
  const jobs = await createSocGenScraper({ now:() => '2026-11-05T09:00:00.000Z' }).run({ fetchPage:reader, fetchText:reader })
  assert.equal(jobs.length, 214)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(jobs.every(job => job.company === 'SocGen' && job.source === 'socgen' && job.companyCareerPage === CAREERS_URL))
  assert.ok(jobs.every(job => job.scrapedAt === '2026-11-05T09:00:00.000Z'))
  assert.equal(jobs.sourceAudit.source, 'socgen')
  assert.equal(jobs.sourceAudit.delegatedSource, 'societegenerale')
  assert.equal(jobs.sourceAudit.nativeIndiaDistinct, 214)
})

test('the real default alias transports share one exact GET budget including validation and failures', async () => {
  const previous = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push({url:String(url),redirect:init.redirect})
    if (requests.length === 1) return {ok:true,status:200,url:CAREERS_URL,text:async () => pages.get(CAREERS_URL).body}
    return {ok:false,status:503,url:String(url),headers:new Headers(),text:async () => 'temporary unavailable'}
  }
  try {
    await assert.rejects(createSocGenScraper().run({maxRequests:2}))
    assert.equal(requests.length, 2)
    assert.ok(requests.every(request => request.redirect === 'error'))
  } finally { globalThis.fetch = previous }
})

test('SocGen passes runtime result and request limits without upgrading incomplete child evidence', async () => {
  const jobs = await createSocGenScraper().run({ maxJobs:1, fetchPage:reader, fetchText:reader })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.match(readInventoryEvidence(jobs)?.reason, /limit/)
  const budget = await createSocGenScraper().run({ maxRequests:4, fetchPage:reader, fetchText:reader })
  assert.equal(budget.length, 1)
  assert.equal(budget.sourceAudit.requests, 4)
  assert.equal(budget.sourceAudit.delegatedRequests, 3)
  assert.equal(readInventoryEvidence(budget)?.listingComplete, false)
  let reads = 0
  const zero = await createSocGenScraper().run({ maxRequests:0,
    fetchPage:async url => { reads += 1; return reader(url) }, fetchText:async url => { reads += 1; return reader(url) } })
  assert.equal(zero.length, 0)
  assert.equal(reads, 0)
  assert.equal(zero.sourceAudit.requests, 0)
  assert.equal(readInventoryEvidence(zero)?.listingComplete, false)
})

test('SocGen pre-abort performs no validation read and keeps an opaque falsey reason', async () => {
  const controller = new AbortController()
  controller.abort(null)
  let reads = 0
  const result = await createSocGenScraper().run({ signal:controller.signal, fetchPage:async url => { reads += 1; return reader(url) } })
    .then(() => ({ status:'resolved' }), reason => ({ status:'rejected', reason }))
  assert.equal(result.status, 'rejected')
  assert.equal(result.reason, null)
  assert.equal(reads, 0)
})

test('SocGen validation cancellation settles even when its reader ignores the caller', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ code:'alias-validation-stop' })
  let release
  let delegated = 0
  let stamped = 0
  const pending = createSocGenScraper({ now:() => { stamped += 1; return 'unexpected' } }).run({
    signal:controller.signal,
    fetchPage:() => new Promise(resolve => { release = () => reader(CAREERS_URL).then(resolve) }),
    fetchText:async url => { delegated += 1; return reader(url) },
  }).then(() => ({ status:'resolved' }), reason => ({ status:'rejected', reason }))
  await new Promise(resolve => setImmediate(resolve))
  controller.abort(reason)
  const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ status:'pending' }),100))])
  await release()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result.status, 'rejected')
  assert.equal(result.reason, reason)
  assert.equal(delegated, 0)
  assert.equal(stamped, 0)
})
