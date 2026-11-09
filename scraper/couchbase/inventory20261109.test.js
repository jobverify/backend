import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasOfficialCareersSignal } from './script.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/inventory-20261109.json.gz', import.meta.url))))
const original = JSON.parse(capture.native.body), officeOriginal = JSON.parse(capture.offices.body)
const transport = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/official-transport-20261109.json.gz', import.meta.url))))
const provider = getScraperCatalog().find(row => row.source === 'couchbase')
const raleigh = payload => payload.jobs.find(row => row.location.name === 'Raleigh, NC')
const office = (payload, id) => payload.offices.find(row => row.id === id)
const allIndexedJobs = payload => payload.offices.flatMap(row => row.departments.flatMap(department => department.jobs))
const replay = async (t, { payload = structuredClone(original), offices = structuredClone(officeOriginal),
  html = capture.official.body, maxJobs = null, blocked = false } = {}) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured Couchbase network request'))
  return createCatalogScraper(provider).run({ maxJobs, now: () => capture.observedAt,
    fetchText: async url => {
      if (url === capture.official.requestedUrl) { if (blocked) throw new Error('HTTP403'); return html }
      assert.equal(url, capture.board.requestedUrl)
      return capture.board.body
    },
    fetchJson: async url => {
      if (url === capture.native.requestedUrl) return payload
      assert.equal(url, capture.offices.requestedUrl)
      if (offices instanceof Error) throw offices
      return offices
    },
  })
}
const held = jobs => {
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'complete-inventory')
}

test('current Couchbase canonical company widget binds its active exact native API despite updated prose', () => {
  assert.equal(hasOfficialCareersSignal(capture.official.body), true)
})

test('registered Couchbase reconciles16 native jobs with independent office index and explicit country parent', async t => {
  const payload = structuredClone(original), offices = structuredClone(officeOriginal)
  const jobs = await replay(t, { payload, offices })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 16)
  assert.equal(evidence.indiaFacetCount, capture.expectedIndiaIds.length)
  assert.deepEqual(jobs.map(row => String(row.jobId)).sort(), capture.expectedIndiaIds)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  const proof = jobs[0].sourceNativeInventoryEvidence
  assert.equal(proof.method, 'couchbase-current-office-index-and-country-parent')
  assert.equal(proof.officeId, 4018013006)
  assert.equal(proof.parentOfficeId, 4006094006)
  assert.equal(proof.nativeParentName, 'United States')
  assert.equal(proof.nativeOfficeName, 'Raleigh, NC')
  assert.equal(proof.indexJobIds.length, 16)
  assert.deepEqual(payload, original)
  assert.deepEqual(offices, officeOriginal)
})

for (const [name, mutate] of [
  ['failed native envelope', p => { p.error = 'unavailable' }],
  ['native continuation', p => { p.hasMore = true }],
  ['missing published total', p => { delete p.meta }],
  ['truncated native count', p => { p.jobs.pop() }],
  ['duplicate native ID', p => { p.jobs[1] = structuredClone(p.jobs[0]) }],
  ['foreign native board', p => { raleigh(p).absolute_url = raleigh(p).absolute_url.replace('/couchbaseinc/', '/foreign/') }],
  ['foreign declared employer outside India', p => { raleigh(p).company_name = 'Foreign Company' }],
  ['unlisted native role', p => { raleigh(p).isListed = false }],
]) test('registered Couchbase refuses ' + name, async t => {
  const payload = structuredClone(original)
  mutate(payload)
  await assert.rejects(replay(t, { payload }), /inventory|native|count|total|identity|company|employer|unlisted/i)
})

for (const [name, mutate] of [
  ['failed office envelope', p => { p.error = 'unavailable' }],
  ['office continuation', p => { p.hasMore = true }],
  ['malformed office array', p => { p.offices = null }],
  ['duplicate office identity', p => { p.offices.push(structuredClone(p.offices[0])) }],
  ['missing country parent', p => { p.offices = p.offices.filter(row => row.id !== 4006094006) }],
  ['foreign country parent name', p => { office(p, 4006094006).name = 'India' }],
  ['missing published child binding', p => { office(p, 4006094006).child_ids = [] }],
  ['conflicting office name', p => { office(p, 4018013006).name = 'Different office' }],
  ['contradictory country field', p => { office(p, 4006094006).country = 'India' }],
  ['unknown current office geography', p => { office(p, 4018013006).location = 'Remote' }],
  ['missing parent reference', p => { office(p, 4018013006).parent_id = 999999999 }],
  ['cyclic office parents', p => { office(p, 4006094006).parent_id = 4018013006 }],
  ['unknown country child', p => { office(p, 4006094006).child_ids.push(999999999) }],
  ['duplicate country child', p => { office(p, 4006094006).child_ids.push(4018013006) }],
  ['foreign country branch as child', p => { office(p, 4006094006).child_ids.push(4006115006) }],
  ['missing indexed role', p => { for (const row of p.offices) for (const department of row.departments) department.jobs = department.jobs.filter(job => job.id !== raleigh(original).id) }],
  ['unaccounted indexed role', p => { const department = p.offices.flatMap(row => row.departments).find(row => row.jobs.length); const extra = structuredClone(department.jobs[0]); extra.id = 999999999; department.jobs.push(extra) }],
  ['foreign indexed role URL', p => { allIndexedJobs(p)[0].absolute_url = 'https://job-boards.greenhouse.io/foreign/jobs/' + allIndexedJobs(p)[0].id }],
  ['conflicting indexed title', p => { allIndexedJobs(p)[0].title = 'Unrelated role' }],
  ['duplicate indexed role within department', p => { const department = p.offices.flatMap(row => row.departments).find(row => row.jobs.length); department.jobs.push(structuredClone(department.jobs[0])) }],
]) test('registered Couchbase keeps ' + name + ' incomplete', async t => {
  const offices = structuredClone(officeOriginal)
  mutate(offices)
  held(await replay(t, { offices }))
})

test('Couchbase transport failure at the additional country witness preserves partial native jobs', async t => {
  const jobs = await replay(t, { offices: new Error('HTTP503') })
  assert.equal(jobs.length, capture.expectedIndiaIds.length)
  held(jobs)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

for (const officeId of [4018013006, 4006094006]) test('Couchbase rejects an India-only role indexed in foreign office branch ' + officeId, async t => {
  const offices = structuredClone(officeOriginal)
  const foreign = office(offices, officeId)
  if (!foreign.departments.length) {
    const template = structuredClone(offices.offices.flatMap(row => row.departments).find(row => row.jobs.length))
    template.jobs = []
    foreign.departments.push(template)
  }
  const department = foreign.departments[0]
  department.jobs.push(structuredClone(allIndexedJobs(offices).find(row => row.id === 4716729006)))
  const jobs = await replay(t, { offices })
  held(jobs)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Couchbase cannot replace a contradictory native country with a country-parent interpretation', async t => {
  const payload = structuredClone(original)
  raleigh(payload).metadata.push({ name: 'Country', value: 'India' })
  const jobs = await replay(t, { payload })
  held(jobs)
  assert.equal(readInventoryEvidence(jobs)?.lifecycleCleanupAllowed, false)
  assert.deepEqual(raleigh(payload).metadata.at(-1), { name: 'Country', value: 'India' })
})

test('Couchbase does not qualify an unqualified city as country evidence', async t => {
  const payload = structuredClone(original)
  const row = payload.jobs.find(record => capture.expectedIndiaIds.includes(String(record.id)))
  row.location.name = 'Bangalore'
  row.offices = [{ id: 99999, name: 'Bangalore', location: null, parent_id: null, child_ids: [] }]
  const jobs = await replay(t, { payload })
  assert.equal(jobs.find(job => String(job.jobId) === String(row.id)).country, null)
  held(jobs)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

for (const maxJobs of [0, 1]) test('Couchbase cap' + maxJobs + ' cannot certify the complete India subset', async t => {
  const jobs = await replay(t, { maxJobs })
  assert.equal(jobs.length, maxJobs)
  held(jobs)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

for (const [name, html] of [
  ['hidden widget', capture.official.body.replace(/<section\b[^>]*data-api-url=["'][^"']+["'][^>]*>[\s\S]*?<\/section>/gi, value => '<template>' + value + '</template>')],
  ['foreign widget account', capture.official.body.replaceAll('/v1/boards/couchbaseinc/jobs', '/v1/boards/foreign/jobs')],
  ['foreign canonical', capture.official.body.replace(/href=["']https:\/\/www\.couchbase\.com\/careers\/["']/i, 'href="https://different.example/careers/"')],
]) test('Couchbase does not qualify ' + name + ' using the public board fallback', async t => {
  const jobs = await replay(t, { html })
  held(jobs)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Couchbase blocked corporate page cannot become complete through the legacy board fallback', async t => {
  held(await replay(t, { blocked: true }))
})

for (const [name, target, finalUrl] of [
  ['exact transport response control', null, null],
  ['foreign corporate redirect', 'official', 'https://different.example/careers/'],
  ['insecure corporate redirect', 'official', 'http://www.couchbase.com/careers/'],
  ['corporate alternate port', 'official', 'https://www.couchbase.com:8443/careers/'],
  ['foreign native redirect', 'native', 'https://different.example/jobs?content=true'],
  ['foreign office redirect', 'offices', 'https://different.example/offices'],
]) test('Couchbase does not qualify ' + name + ' even with the original branded body', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const key = ['official', 'native', 'offices', 'board'].find(key => capture[key].requestedUrl === url)
    assert.ok(key, 'Captured request only: ' + url)
    const response = new Response(capture[key].body, { status: 200,
      headers: { 'content-type': ['native', 'offices'].includes(key) ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: key === target ? finalUrl : capture[key].finalUrl })
    return response
  })
  if (target === null) {
    assert.equal(readInventoryEvidence(await createCatalogScraper(provider).run())?.status, 'complete-inventory')
  } else if (target === 'native') {
    await assert.rejects(createCatalogScraper(provider).run(), /identity|URL|redirect|response/i)
  } else {
    held(await createCatalogScraper(provider).run())
  }
})

test('Couchbase default runtime uses its currently observed public User-Agent while retaining real denied responses', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const key = ['official', 'native', 'offices', 'board'].find(key => capture[key].requestedUrl === url)
    assert.ok(key, 'Captured request only: ' + url)
    const observed = key === 'official' ? transport.responses.find(row => row.ua === options.headers['User-Agent']) : null
    if (key === 'official') assert.ok(observed, 'Exact independently observed public User-Agent')
    const response = new Response(observed?.body || capture[key].body, { status: observed?.status || 200,
      headers: { 'content-type': ['native', 'offices'].includes(key) ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: observed?.finalUrl || capture[key].finalUrl })
    return response
  })
  const jobs = await createCatalogScraper(provider).run()
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.equal(jobs.length, 8)
})

for (const target of ['official', 'native', 'offices']) test('Couchbase does not qualify a branded ' + target + ' body with a foreign content type', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const key = ['official', 'native', 'offices', 'board'].find(key => capture[key].requestedUrl === url)
    assert.ok(key, 'Captured request only: ' + url)
    const response = new Response(capture[key].body, { status: 200,
      headers: { 'content-type': key === target ? 'text/plain' : ['native', 'offices'].includes(key) ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: capture[key].finalUrl })
    return response
  })
  if (target === 'native') await assert.rejects(createCatalogScraper(provider).run(), /content.type|identity|response/i)
  else held(await createCatalogScraper(provider).run())
})

test('Couchbase explicitly reconciles empty native and office indices and holds a contradictory empty', async t => {
  const payload = { jobs: [], meta: { total: 0 } }
  const offices = structuredClone(officeOriginal)
  for (const row of offices.offices) for (const department of row.departments) department.jobs = []
  const jobs = await replay(t, { payload, offices })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  const conflicting = await replay(t, { payload })
  held(conflicting)
  assert.equal(readInventoryEvidence(conflicting)?.lifecycleCleanupAllowed, false)
})

test('Couchbase image-only selected content cannot qualify a complete extraction', async t => {
  const payload = structuredClone(original)
  payload.jobs.find(row => capture.expectedIndiaIds.includes(String(row.id))).content = '<p><img src="https://couchbase.com/description.png"></p>'
  const jobs = await replay(t, { payload })
  held(jobs)
  assert.ok(jobs.some(job => job.sourceDetailComplete === false))
})

const opaqueAbortReason = () => {
  const reason = Object.create(null)
  Object.defineProperty(reason, 'message', { get: () => assert.fail('Opaque caller reason must not be inspected') })
  Object.defineProperty(reason, Symbol.toPrimitive, { value: () => assert.fail('Opaque caller reason must not be coerced') })
  return reason
}
for (const boundary of ['admission', 'corporate-return', 'native-return', 'corporate-reject', 'office-reject']) test('couchbase preserves opaque caller abort at ' + boundary, async () => {
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
        assert.equal(url, capture.offices.requestedUrl)
        if (boundary === 'office-reject') { controller.abort(reason); throw reason }
        return structuredClone(officeOriginal)
      },
    })
  } catch (error) { failure = error }
  assert.equal(failure, reason)
  assert.equal(seen.length, boundary === 'admission' ? 0 : boundary === 'native-return' ? 2 : boundary === 'office-reject' ? 3 : 1)
})

test('couchbase default transport forwards caller cancellation during the native request', async t => {
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

for (const declaration of ['display:none!important', 'opacity:0']) test('couchbase requires a visible corporate handoff: ' + declaration, async t => {
 const html = capture.official.body + '<style>[aria-label="Open Positions"]{' + declaration + '}</style>'
 const jobs = await replay(t, { html }); held(jobs); assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Couchbase holds a reciprocal country graph that places United States beneath India', async t => {
 const payload=structuredClone(original),offices=structuredClone(officeOriginal),byId=new Map(offices.offices.map(row=>[row.id,row]))
 byId.get(4006094006).parent_id=4006115006
 for(const ancestor of offices.offices)ancestor.child_ids=offices.offices.filter(row=>{let current=row.parent_id;while(current!==null){if(current===ancestor.id)return true;current=byId.get(current).parent_id}return false}).map(row=>row.id)
 for(const row of payload.jobs)row.offices=row.offices.map(ref=>{const office=byId.get(ref.id);return {id:office.id,name:office.name,location:office.location,child_ids:office.child_ids,parent_id:office.parent_id}})
 const jobs=await replay(t,{payload,offices});held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
