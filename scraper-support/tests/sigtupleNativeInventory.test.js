import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import {createSigtupleNativeScraper} from '../../scraper/sigtuple/native.js'
import {replay as currentReplay} from '../native-sources/publicNativeGetSources/fixtureReplay.js'
// Legacy POST-helper compatibility only; registered SigTuple uses the GET reader.
const run=options=>createSigtupleNativeScraper().run(options)
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/sigtuple/native-captures/current-unbound-20261101.json.gz', import.meta.url))))
const HOME = 'https://sigtuple.com/'
const ACCOUNT = 'https://apply.workable.com/api/v1/accounts/sigtuple'
const LISTING = 'https://apply.workable.com/api/v3/accounts/sigtuple/jobs'
const DETAIL = 'https://apply.workable.com/api/v2/accounts/sigtuple/jobs/NATIVE1001'
const UID = '301bb372-b567-4bfd-afe1-ca0035561689'
const india = { city: 'Bengaluru', region: 'Karnataka', country: 'India', countryCode: 'IN', hidden: false }
// Explicitly synthetic native records exercise a future proven handoff; these
// are not current SigTuple jobs and must never be reported as recovered jobs.
const synthetic = () => {
  const record = { id: 1001, shortcode: 'NATIVE1001', title: 'Platform Engineer', accountUid: UID,
    state: 'published', isInternal: false, approvalStatus: 'approved', location: { ...india }, locations: [{ ...india }],
    published: '2026-10-24T00:00:00.000Z', workplace: 'hybrid', remote: false }
  return {
    html: '<title>SigTuple</title><a href="https://apply.workable.com/sigtuple/">Careers</a>',
    account: { id: 100, uid: UID, name: 'SigTuple', subdomain: 'sigtuple', url: 'http://sigtuple.com/' },
    listing: { total: 1, results: [record] },
    detail: { ...structuredClone(record), description: '<p>Build reliable diagnostic systems for healthcare. Preserve complete clinical workflows and robust automated analysis for our users.</p>',
      requirements: '<ul><li>Strong programming skills and experience maintaining reliable distributed systems.</li></ul>', benefits: '<p>Learning support and flexible leave.</p>' },
  }
}
const options = (data, mutate = () => {}) => {
  const calls = [], counts = new Map()
  return { calls, now: () => '2026-10-31T23:45:00.000Z',
    fetchText: async () => capture.packets.find(p => p.url.endsWith('/jobs.md')).body,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method, body: init.body ?? null }); init.signal?.throwIfAborted()
      const index = counts.get(url) || 0; counts.set(url, index + 1)
      let body, type = 'application/json', status = 200
      if (url === HOME) { body = data?.html ?? capture.packets.find(p => p.url === HOME).body; type = 'text/html' }
      else if (url === ACCOUNT) body = JSON.stringify(data.account)
      else if (url === LISTING) {
        assert.equal(init.method, 'POST')
        assert.deepEqual(JSON.parse(init.body), { query: '', location: [], department: [], worktype: [], remote: [] })
        body = JSON.stringify(data.listing)
      } else if (url === DETAIL) body = JSON.stringify(data.detail)
      else assert.fail('Unreviewed URL: ' + url)
      const packet = { url, body, type, status }; mutate(packet, index)
      const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.type,
        'content-length': Buffer.byteLength(packet.body).toString() } })
      Object.defineProperty(response, 'url', { value: packet.url })
      return response
    } }
}

test('captured current SigTuple site cannot turn an unbound historical zero into current empty evidence', async () => {
  const opts = options()
  await assert.rejects(run(opts), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.match(error.message, /handoff/i)
    assert.equal(error.nativeEvidence.handoffVerified, false)
    assert.equal(error.nativeEvidence.cleanupAllowed, false)
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
    assert.equal(error.nativeEvidence.rawJobs, null)
    assert.equal(error.nativeEvidence.indiaJobs, null)
    assert.equal(error.nativeEvidence.retainedResponses[0].url, HOME)
    assert.equal(error.nativeEvidence.retainedResponses[0].bodyBytes, Buffer.byteLength(capture.packets.find(p => p.url === HOME).body))
    return true
  })
  assert.deepEqual(opts.calls.map(c => c.url), [HOME])
})



test('a synthetic bound native role retains full original sections, dates, country proof, and native application', async () => {
  const data = synthetic(), opts = options(data), jobs = await run(opts)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.company, 'SigTuple')
  assert.equal(job.country, 'India')
  assert.equal(job.postingDate, data.detail.published)
  assert.equal(job.applyUrl, 'https://apply.workable.com/sigtuple/j/NATIVE1001/apply/')
  assert.deepEqual(job.sourceNativeDescriptionSections, { description: data.detail.description,
    requirements: data.detail.requirements, benefits: data.detail.benefits })
  assert.deepEqual(job.sourceNativeLocations, data.detail.locations)
  assert.match(job.jobDescription, /clinical workflows[\s\S]*programming skills[\s\S]*flexible leave/)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(job.nativeCollectionEvidence.nativeBoardListingComplete, true)
  assert.equal(opts.calls.filter(c => c.url === LISTING).length, 2)
  assert.equal(opts.calls.filter(c => c.url === DETAIL).length, 2)
})

test('a bound board with only foreign roles is distinct from whole-company empty', async () => {
  const data = synthetic(), foreign = { city: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB', hidden: false }
  Object.assign(data.listing.results[0], { location: foreign, locations: [foreign] })
  await assert.rejects(run(options(data)), error => {
    assert.equal(error.nativeEvidence.rawJobs, 1)
    assert.equal(error.nativeEvidence.indiaJobs, 0)
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
    assert.equal(error.nativeEvidence.cleanupAllowed, false)
    return true
  })
})

test('a bound native zero remains board-scoped while whole-company scope is unresolved', async () => {
  const data = synthetic(); data.listing = { total: 0, results: [] }
  await assert.rejects(run(options(data)), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.nativeEvidence.rawJobs, 0)
    assert.equal(error.nativeEvidence.nativeBoardListingComplete, true)
    assert.equal(error.nativeEvidence.wholeCompanyScope, false)
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
    return true
  })
})

for (const [label, html] of [
  ['comment', '<!--<a href="https://apply.workable.com/sigtuple/">Careers</a>-->'],
  ['script', '<script>const s=\'<a href="https://apply.workable.com/sigtuple/">Careers</a>\'</script>'],
  ['hidden', '<a hidden href="https://apply.workable.com/sigtuple/">Careers</a>'],
  ['CSS-hidden', '<style>a{display:none}</style><a href="https://apply.workable.com/sigtuple/">Careers</a>'],
  ['foreign tenant', '<a href="https://apply.workable.com/other/">Careers</a>'],
  ['filtered tenant', '<a href="https://apply.workable.com/sigtuple/?country=India">Careers</a>'],
]) test('SigTuple rejects ' + label + ' as employer handoff proof', async () => {
  const data = synthetic(); data.html = html; const opts = options(data)
  await assert.rejects(run(opts), /handoff/i)
  assert.equal(opts.calls.length, 1)
})

for (const [label, change] of [
  ['foreign account', d => { d.account.uid = 'foreign' }],
  ['foreign employer', d => { d.account.name = 'Other Employer' }],
  ['foreign reciprocal website', d => { d.account.url = 'https://other.example/' }],
  ['country conflict', d => { d.detail.locations[0].country = 'United States' }],
  ['missing description', d => { d.detail.description = '<script>example text</script>' }],
  ['impossible publication date', d => { d.detail.published = '2026-02-30' }],
  ['truncated listing', d => { d.listing.total = 2 }],
  ['internal role', d => { d.listing.results[0].isInternal = true }],
  ['CSS-hidden description', d => { d.detail.description = '<style>#jd{display:none}</style><div id="jd">' + d.detail.description + '</div>' }],
]) test('SigTuple fails closed for ' + label, async () => {
  const data = synthetic(); change(data)
  await assert.rejects(run(options(data)))
})

test('SigTuple retains a missing publication date as unknown rather than using the check clock', async () => {
  const data = synthetic(); data.listing.results[0].published = null; data.detail.published = null
  const [job] = await run(options(data))
  assert.equal(job.postingDate, null)
  assert.equal(job.nativePublicationDate, null)
  assert.equal(job.postedAt, null)
})

test('SigTuple preserves the original publication timestamp representation', async () => {
  const data = synthetic(), original = '2026-10-24T05:30:00+05:30'
  data.listing.results[0].published = original; data.detail.published = original
  const [job] = await run(options(data))
  assert.equal(job.postingDate, original)
  assert.equal(job.nativePublicationDate, original)
})

for (const status of [302, 403]) test('SigTuple stops a ' + status + ' company route without following or retrying it', async () => {
  const opts = options(undefined, packet => { packet.status = status })
  await assert.rejects(run(opts), error => {
    assert.match(error.message, new RegExp('HTTP ' + status))
    assert.equal(error.nativeEvidence.rawJobs, null)
    assert.equal(error.nativeEvidence.retainedResponses[0].status, status)
    return true
  })
  assert.equal(opts.calls.length, 1)
})

test('SigTuple rejects a non-JSON native response without treating it as zero', async () => {
  const opts = options(synthetic(), packet => { if (packet.url === LISTING) { packet.type = 'text/html'; packet.body = '<title>Sign in</title>' } })
  await assert.rejects(run(opts), error => {
    assert.match(error.message, /content type/)
    assert.equal(error.nativeEvidence.rawJobs, null)
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
    return true
  })
})

test('a changed closing description cannot produce a stable role', async () => {
  const data = synthetic()
  await assert.rejects(run(options(data, (packet, index) => {
    if (packet.url === DETAIL && index === 1) { const value = JSON.parse(packet.body); value.description += '<p>Changed.</p>'; packet.body = JSON.stringify(value) }
  })), error => error.nativeEvidence.cleanupAllowed === false)
})

test('SigTuple honors cancellation before any public request', async () => {
  const opts = options()
  await assert.rejects(run({ ...opts, signal: AbortSignal.abort(new Error('SigTuple cancelled')) }), /SigTuple cancelled/)
  assert.equal(opts.calls.length, 0)
})

test('SigTuple bounds an abort-ignoring response and cancels oversized streams', async () => {
  let cancelled = false
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async () => new Promise(() => {}) }), /timeout/i)
  await assert.rejects(run({ fetchImpl: async url => {
    const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)) }, cancel() { cancelled = true } })
    const response = new Response(body, { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  } }), /bound|limit/i)
  assert.equal(cancelled, true)
})

test('registered SigTuple uses original public GETs and records the current missing company handoff without persistence',async()=>{const p=getScraperCatalog().find(p=>p.source==='sigtuple'),r=currentReplay(),jobs=await createCatalogScraper(p).run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.audits[0].employerBindingQualified,false);assert.equal(r.audits[0].sourceScopeComplete,false);assert.ok(r.requests.some(u=>u.includes('?details=true')));assert.ok(!r.requests.some(u=>u.includes('/api/v3/')))})
