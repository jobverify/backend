import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/inventory-20261109.json.gz', import.meta.url))))
for (const response of [capture.native, capture.official]) {
  assert.equal(createHash('sha256').update(response.body).digest('hex'), response.sha256)
}
const original = JSON.parse(capture.native.body)
const provider = getScraperCatalog().find(row => row.source === 'ghxindia')
const us = payload => payload.jobs.find(row => row.location.name === 'Office Location or Remote - USA')
const withoutUnmatchedFeaturedRole = capture.official.body.replace(/<button\b[^>]*data-bs-jobUrl=["']https:\/\/job-boards\.greenhouse\.io\/globalhealthcareexchangeinc\/jobs\/4730895005["'][^>]*>[\s\S]*?<\/button>/gi, '')
const replay = async (t, { payload = structuredClone(original), html = capture.official.body, maxJobs = null } = {}) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured GHX network request'))
  return createCatalogScraper(provider).run({ maxJobs, now: () => capture.observedAt,
    fetchText: async url => { assert.equal(url, capture.official.requestedUrl); return html },
    fetchJson: async url => { assert.equal(url, capture.native.requestedUrl); return payload },
  })
}

test('registered GHX holds the original current unmatched featured role while preserving30 native and14 India observations', async t => {
  const jobs = await replay(t)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 30)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.match(evidence.reason, /4730895005/)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('GHX future reconciled-handoff control proves30 roles and14 India roles without changing literal native data', async t => {
  const payload = structuredClone(original)
  const jobs = await replay(t, { payload, html: withoutUnmatchedFeaturedRole })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 30)
  assert.equal(evidence.indiaFacetCount, 14)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  const proof = jobs[0].sourceNativeInventoryEvidence
  assert.equal(proof.method, 'ghx-explicit-usa-office-template')
  assert.equal(proof.officeId, 4007048005)
  assert.equal(proof.nativeLocation, 'Office Location or Remote - USA')
  assert.equal(proof.interpretedCountry, 'United States')
  assert.equal(proof.jobIds.length, 16)
  assert.deepEqual(payload, original, 'Literal native fields and metadata must remain unchanged')
  for (const job of jobs) {
    const native = original.jobs.find(row => String(row.id) === String(job.jobId))
    assert.deepEqual(job.sourceNativeLocation, native.location)
    assert.deepEqual(job.sourceNativeOffices, native.offices)
  }
})

for (const [name, mutate] of [
  ['failed native envelope', p => { p.success = false }],
  ['explicit native error', p => { p.error = 'temporarily unavailable' }],
  ['truncated native total', p => { p.jobs.pop() }],
  ['missing published total', p => { delete p.meta }],
  ['string published total', p => { p.meta.total = '30' }],
  ['native continuation', p => { p.hasMore = true }],
  ['duplicate native role', p => { p.jobs[1] = structuredClone(p.jobs[0]) }],
  ['malformed native row', p => { p.jobs[0] = null }],
  ['fractional native role identity', p => { p.jobs[0].id = 1.5 }],
  ['foreign native board', p => { us(p).absolute_url = us(p).absolute_url.replace('/globalhealthcareexchangeinc/', '/foreign/') }],
  ['foreign native role URL', p => { us(p).absolute_url = 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/999999999' }],
  ['insecure native URL', p => { us(p).absolute_url = us(p).absolute_url.replace('https:', 'http:') }],
  ['credentialed native URL', p => { us(p).absolute_url = us(p).absolute_url.replace('https://', 'https://other@') }],
  ['foreign declared employer outside India', p => { us(p).company_name = 'Foreign Employer' }],
  ['explicitly unlisted native role', p => { us(p).isListed = false }],
]) test('registered GHX refuses ' + name, async t => {
  const payload = structuredClone(original)
  mutate(payload)
  await assert.rejects(replay(t, { payload }), /inventory|native|total|identity|URL|employer|company|unlisted|Incomplete/i)
})

for (const [name, mutate] of [
  ['unreviewed USA office identity', p => { us(p).offices[0].id++ }],
  ['missing literal country qualifier', p => { const row = us(p); row.location.name = 'Office Location or Remote'; row.offices[0].name = row.location.name }],
  ['another supplied office', p => { us(p).offices.push({ id: 99, name: 'Remote', location: null, parent_id: null, child_ids: [] }) }],
  ['contradictory supplied office geography', p => { us(p).offices[0].country = 'India' }],
]) test('registered GHX keeps ' + name + ' incomplete', async t => {
  const payload = structuredClone(original)
  mutate(payload)
  const jobs = await replay(t, { payload })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('registered GHX rejects a contradictory explicit country beside the USA template', async t => {
  const payload = structuredClone(original)
  us(payload).metadata = [{ name: 'Country', value: 'India' }]
  await assert.rejects(replay(t, { payload }), /contradictory|country|Country/i)
})

test('GHX does not qualify an unqualified city as country evidence', async t => {
  const payload = structuredClone(original)
  const row = payload.jobs.find(record => /India/.test(record.location.name))
  row.location.name = 'Hyderabad'
  row.offices = [{ id: 99999, name: 'Hyderabad', location: 'Hyderabad', parent_id: null, child_ids: [] }]
  const jobs = await replay(t, { payload, html: withoutUnmatchedFeaturedRole })
  assert.equal(jobs.find(job => String(job.jobId) === String(row.id)).country, null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

for (const maxJobs of [0, 1]) test('registered GHX cap' + maxJobs + ' cannot certify full India inventory', async t => {
  const jobs = await replay(t, { maxJobs })
  assert.equal(jobs.length, maxJobs)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

for (const body of ['', '<p>Apply now</p>', '<template>' + original.jobs[0].content + '</template><p>Job Description</p>']) {
  test('registered GHX keeps a missing, prompt-only or inactive description incomplete: ' + body.slice(0, 24), async t => {
    const payload = structuredClone(original)
    payload.jobs[0].content = body
    const jobs = await replay(t, { payload })
    assert.equal(jobs.find(row => String(row.jobId) === String(payload.jobs[0].id)).sourceDetailComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  })
}

test('registered GHX requires an active exact official board handoff', async t => {
  const html = capture.official.body.replace(/<button\b[^>]*data-bs-jobUrl=["'][^"']+["'][^>]*>[\s\S]*?<\/button>/gi,
    button => '<template>' + button + '</template>')
  await assert.rejects(replay(t, { html }), /official|handoff|first-party/i)
})

test('registered GHX refuses an additional foreign Greenhouse handoff', async t => {
  await assert.rejects(replay(t, { html: capture.official.body + '<a href="https://job-boards.greenhouse.io/foreign">Other positions</a>' }), /foreign|handoff|scope/i)
})

for (const target of [null, 'official', 'native']) test('GHX transport identity control or foreign ' + target + ' response URL even with its original branded body', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const key = ['official', 'native'].find(key => capture[key].requestedUrl === url)
    assert.ok(key, 'Captured request only: ' + url)
    const body = key === 'official' ? withoutUnmatchedFeaturedRole : capture[key].body
    const response = new Response(body, { status: 200,
      headers: { 'content-type': capture[key].contentType || 'text/html' } })
    Object.defineProperty(response, 'url', { value: key === target ? 'https://different.example/response' : capture[key].finalUrl })
    return response
  })
  if (target === null) {
    assert.equal(readInventoryEvidence(await createCatalogScraper(provider).run())?.status, 'complete-inventory')
  } else {
    await assert.rejects(createCatalogScraper(provider).run(), /identity|URL|redirect|response/i)
  }
})

for (const target of ['official', 'native']) test('GHX refuses a branded ' + target + ' body with a foreign content type', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const key = ['official', 'native'].find(key => capture[key].requestedUrl === url)
    assert.ok(key, 'Captured request only: ' + url)
    const response = new Response(key === 'official' ? withoutUnmatchedFeaturedRole : capture[key].body, { status: 200,
      headers: { 'content-type': key === target ? 'text/plain' : capture[key].contentType } })
    Object.defineProperty(response, 'url', { value: capture[key].finalUrl })
    return response
  })
  await assert.rejects(createCatalogScraper(provider).run(), /content.type|identity|response/i)
})

test('registered GHX distinguishes an authoritative empty from failed or uncounted empty feeds', async t => {
  const html = '<title>GHX Careers | GHX</title><a href="https://job-boards.greenhouse.io/globalhealthcareexchangeinc">View all positions</a>'
  const jobs = await replay(t, { payload: { jobs: [], meta: { total: 0 } }, html })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  for (const payload of [{ jobs: [] }, { jobs: [], meta: { total: 0 }, error: 'unavailable' }]) {
    await assert.rejects(replay(t, { payload, html }), /inventory|total|native|Failed/i)
  }
  const held = await replay(t, { payload: { jobs: [], meta: { total: 0 } } })
  assert.equal(readInventoryEvidence(held)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(held)?.lifecycleCleanupAllowed, false)
})

const opaqueAbortReason = () => {
  const reason = Object.create(null)
  Object.defineProperty(reason, 'message', { get: () => assert.fail('Opaque caller reason must not be inspected') })
  Object.defineProperty(reason, Symbol.toPrimitive, { value: () => assert.fail('Opaque caller reason must not be coerced') })
  return reason
}
for (const boundary of ['admission', 'corporate-return', 'native-return']) test('ghxindia preserves opaque caller abort at ' + boundary, async () => {
  const controller = new AbortController(), reason = opaqueAbortReason(), seen = []
  if (boundary === 'admission') controller.abort(reason)
  let failure
  try {
    await createCatalogScraper(provider).run({ signal: controller.signal,
      fetchText: async (url, options) => {
        seen.push({ type: 'text', url }); assert.equal(options?.signal, controller.signal)
        if (boundary === 'corporate-return' || boundary === 'corporate-reject') controller.abort(reason)
        if (boundary === 'corporate-reject') throw reason
        return capture.official.body
      },
      fetchJson: async (url, options) => {
        seen.push({ type: 'json', url }); assert.equal(options?.signal, controller.signal)
        if (url === capture.native.requestedUrl) {
          if (boundary === 'native-return') controller.abort(reason)
          return structuredClone(original)
        }
        assert.fail('No extra request admitted')
      },
    })
  } catch (error) { failure = error }
  assert.equal(failure, reason)
  assert.equal(seen.length, boundary === 'admission' ? 0 : boundary === 'native-return' ? 2 : boundary === 'office-reject' ? 3 : 1)
})

test('ghxindia default transport forwards caller cancellation during the native request', async t => {
  const controller = new AbortController(), reason = opaqueAbortReason(), seen = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    seen.push(options.signal)
    const key = url === capture.official.requestedUrl ? 'official' : 'native'
    assert.equal(url, capture[key].requestedUrl)
    if (key === 'native') controller.abort(reason)
    const response = new Response(capture[key].body, { status: 200, headers: { 'content-type': capture[key].contentType } })
    Object.defineProperty(response, 'url', { value: capture[key].finalUrl })
    return response
  })
  let failure
  try { await createCatalogScraper(provider).run({ signal: controller.signal }) } catch (error) { failure = error }
  assert.equal(failure, reason)
  assert.equal(seen.length, 2)
  assert.ok(seen.every(signal => signal?.aborted === true))
})

for (const declaration of ['display:none!important', 'opacity:0']) test('ghxindia requires a visible corporate handoff: ' + declaration, async t => {
 const html = capture.official.body + '<style>button[data-bs-joburl]{' + declaration + '}</style>'
 await assert.rejects(replay(t, { html }), /handoff|official|active|visible/i)
})

test('GHX hidden-only corporate board link cannot qualify an empty inventory', async t => {
 const html='<title>GHX Careers | GHX</title><a href="https://job-boards.greenhouse.io/globalhealthcareexchangeinc">View all positions</a><style>a{display:none!important}</style>'
 await assert.rejects(replay(t,{payload:{jobs:[],meta:{total:0}},html}),/handoff|official|active|visible/i)
})
