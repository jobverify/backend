import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import * as source from './script.js'
const listing = JSON.parse(await fs.readFile(new URL('./fixtures/current-listing.json', import.meta.url)))
const nativeDetail = JSON.parse(await fs.readFile(new URL('./fixtures/current-detail.json', import.meta.url)))
const raw = listing.data.data[0]._source
const clone = (value) => structuredClone(value)
const record = (index = 0) => ({ ...clone(raw), id: raw.id + index, jobCode: raw.jobCode + index, newJobCode: String(raw.jobCode + index), jobUrl: raw.jobUrl + '-' + index, jobTitle: raw.jobTitle + ' ' + index, mediumDescriptionWithoutHtml: 'Publisher full description. ' + 'Responsibilities and requirements. '.repeat(10), metaDescription: 'Publisher full description. ' + 'Responsibilities and requirements. '.repeat(10) })
const page = (rows, total = rows.length, size = 9, offset = 0) => ({ data: { data: rows.map(_source => ({ _source })), totalCount: total, hasMoreData: offset + rows.length < total, facetedSearchConfig: { paginationHowMuch: String(size) } } })
const detail = (r) => ({ ...clone(nativeDetail), id: r.id, jobCode: r.jobCode, jobUrl: r.jobUrl, jobTitle: r.jobTitle, location: r.location, jobConfigurationData: { ...clone(nativeDetail.jobConfigurationData), Description: '<p>' + r.mediumDescriptionWithoutHtml + '</p>' } })
const run = (options) => source.run({ now: () => '2026-10-09T00:00:00.000Z', ...options })

test('current published company ID and response page size enumerate beyond the old five-page cap', async () => {
  const rows = Array.from({ length: 13 }, (_, i) => record(i)), offsets = []
  const jobs = await run({ fetchJson: async (url, options) => {
    if (url === source.LISTING_API_URL) {
      assert.equal(options.form.companyId, 'MTU1Nzg=')
      const offset = JSON.parse(options.form.filterCri).paginationStartNo; offsets.push(offset)
      return page(rows.slice(offset, offset + 2), rows.length, 2, offset)
    }
    assert.equal(options.json.companyId, String(raw.companyId))
    return detail(rows.find(r => r.jobUrl === options.json.jobUrl))
  } })
  assert.deepEqual(offsets, [0, 2, 4, 6, 8, 10, 12, 0]); assert.equal(jobs.length, 13)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('malformed publisher error JSON cannot become a verified empty inventory', async () => {
  await assert.rejects(run({ fetchJson: async () => ({ message: 'Internal Server Error' }) }), /inventory|payload|response/i)
})

test('missing details retain only substantive native full descriptions and mark every output incomplete', async () => {
  const a = record(0), b = record(1); b.mediumDescriptionWithoutHtml = 'JD'; b.metaDescription = 'JD'
  const jobs = await run({ fetchJson: async url => { if (url === source.LISTING_API_URL) return page([a, b]); throw new Error('HTTP 403 for detail') } })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobDescription, a.mediumDescriptionWithoutHtml.trim())
  assert.equal(jobs[0].sourceListingComplete, false); assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap'); assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('configured maxPages and maxJobs always retain partial inventory evidence', async () => {
  const rows = [record(0), record(1), record(2)]
  for (const limits of [{ maxPages: 1 }, { maxJobs: 1 }]) {
    const jobs = await run({ ...limits, fetchJson: async (url, options) => { if (url === source.LISTING_API_URL) { const offset = JSON.parse(options.form.filterCri).paginationStartNo; return page(rows.slice(offset, offset + 2), 3, 2, offset) } return detail(rows.find(r => r.jobUrl === options.json.jobUrl)) } })
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false); assert.ok(jobs.every(job => job.sourceListingComplete === false))
  }
})

for (const [name, mutate] of [
  ['wrong employer', r => { r.companyId = 99999 }],
  ['wrong portal', r => { r.careerSiteUrl = 'other-employer.example' }],
  ['unknown country', r => { r.jobLocationRecord[0].country = 'Remote' }],
  ['pseudo country', r => { r.jobLocationRecord[0].country = 'ZZ' }],
  ['contradictory country', r => { r.jobLocationRecord[0].country = 'United States' }],
  ['nonpublic status', r => { r.status = 0 }],
]) test(name + ' fails closed before accepting source rows', async () => {
  const r = record(); mutate(r)
  await assert.rejects(run({ fetchJson: async (url, options) => url === source.LISTING_API_URL ? page([r]) : detail(r) }), /inventory|country|employer|portal|status/i)
})

for (const [name, mutate] of [
  ['detail company mismatch', d => { d.companyId = 99999 }],
  ['detail code mismatch', d => { d.jobCode = 99999 }],
  ['detail title mismatch', d => { d.jobTitle = 'Unrelated role' }],
  ['detail slug mismatch', d => { d.jobUrl = 'unrelated-slug' }],
  ['detail nonpublic status', d => { d.status = 0 }],
  ['detail foreign location', d => { d.location = 'New York, United States' }],
]) test(name + ' cannot silently fall back to a listing preview', async () => {
  const r = record(), d = detail(r); mutate(d)
  await assert.rejects(run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : d }), /inventory|detail|identity|location|status/i)
})

test('short pages, changing totals, and duplicate identities cannot certify complete inventory', async () => {
  for (const kind of ['short', 'drift', 'duplicate']) {
    let calls = 0; const a = record(0), b = record(1), c = record(2)
    await assert.rejects(run({ fetchJson: async (url, options) => {
      if (url !== source.LISTING_API_URL) return detail([a, b, c].find(r => r.jobUrl === options.json.jobUrl))
      calls += 1
      if (kind === 'short') return page([a], 3, 2)
      if (calls === 1) return page([a, b], 3, 2)
      if (kind === 'drift') return page([c], 4, 2, 2)
      return page([{ ...a, jobTitle: 'Conflicting duplicate' }], 3, 2, 2)
    } }), /inventory|count|page|duplicate/i)
  }
})

test('explicit zero is accepted only with the complete count and paging contract', async () => {
  const jobs = await run({ fetchJson: async () => page([], 0) })
  assert.equal(jobs.length, 0); assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
})

test('empty count metadata and missing page flags cannot authorize a verified zero', async () => {
  for (const mutate of [p => { p.data.totalCount = '' }, p => { delete p.data.hasMoreData }]) {
    const payload = page([], 0); mutate(payload)
    await assert.rejects(run({ fetchJson: async () => payload }), /inventory|count|paging/i)
  }
})
test('private visibility and ellipsized previews cannot provide full-description fallback', async () => {
  const a = record(0), b = record(1); a.jobVisibility = 'Private'; b.mediumDescriptionWithoutHtml += '...'; b.metaDescription = b.mediumDescriptionWithoutHtml
  const jobs = await run({ fetchJson: async url => { if (url === source.LISTING_API_URL) return page([a,b]); throw new Error('HTTP 403 for detail') } })
  assert.equal(jobs.length, 0); assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
})

test('the published comma-and-space slug is safely encoded as one first-party path segment', async () => {
  const r = record(); r.jobUrl = 'vice president corporate sales-noida-corporate sales, enterprise sales, sme sales, team management-202601231816332'
  const jobs = await run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : detail(r) })
  assert.equal(jobs.length, 1); assert.ok(jobs[0].sourceUrl.endsWith(encodeURIComponent(r.jobUrl)))
})

for (const [name, mutate] of [
  ['explicit country', d => { d.country = 'United States' }],
  ['structured country', d => { d.jobLocationRecord = [{ country: 'United States', formattedLocation: 'Noida, India' }] }],
]) test('native detail ' + name + ' contradicting India fails closed', async () => {
  const r = record(), d = detail(r); mutate(d)
  await assert.rejects(run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : d }), /inventory|country/i)
})
test('verified India rows explicitly expose country to the shared runner', async () => {
  const r = record(); const jobs = await run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : detail(r) })
  assert.equal(jobs[0].country, 'India')
})
test('a counted source must recheck its first-page identity and status after details', async () => {
  for (const mutation of [r => { r.jobTitle = 'Changed title' }, r => { r.status = 0 }, r => { r.jobLocationRecord[0].country = 'United States' }]) {
    const r = record(); let listings = 0
    await assert.rejects(run({ fetchJson: async url => { if (url !== source.LISTING_API_URL) return detail(r); listings += 1; const value = clone(r); if (listings > 1) mutation(value); return page([value]) } }), /inventory|snapshot|status|country/i)
    assert.equal(listings, 2)
  }
})
test('caller cancellation during details propagates instead of becoming fallback coverage', async () => {
  const controller = new AbortController(), r = record()
  await assert.rejects(run({ signal: controller.signal, fetchJson: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    if (url === source.LISTING_API_URL) return page([r])
    controller.abort(new Error('cancelled by caller')); throw new DOMException('aborted', 'AbortError')
  } }), /cancelled by caller/)
})
test('native transport has a bounded timeout even when a server never responds', async () => {
  const original = globalThis.fetch; let requestSignal
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    globalThis.fetch = async (_url, options) => { requestSignal = options.signal; if (!requestSignal) throw new Error('missing request signal'); return new Promise((_resolve, reject) => { options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true }) }) }
    await assert.rejects(run({ requestTimeoutMs: 5 }), /timeout|timed out/i)
    assert.equal(requestSignal.aborted, true)
  } finally { globalThis.fetch = original; clearTimeout(keepAlive) }
})
test('native literal JD placeholders do not become complete jobs', async () => {
  const r = record(), d = detail(r); d.jobConfigurationData.Description = 'JD'
  const jobs = await run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : d })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobDescription, null); assert.equal(jobs[0].sourceDetailComplete, false); assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
})

test('native transport never serializes an abort signal as an HTTP header', async () => {
  const original = globalThis.fetch, r = record(), requests = []
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(Object.hasOwn(init.headers, 'signal'), false)
      assert.ok(init.signal instanceof AbortSignal)
      requests.push({ url, init })
      const response = new Response(JSON.stringify(url === source.LISTING_API_URL ? page([r]) : detail(r)), { headers: { 'Content-Type': 'application/json' } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    }
    const jobs = await run(); assert.equal(jobs.length, 1); assert.equal(requests.length, 3)
  } finally { globalThis.fetch = original }
})
for (const stage of ['listing', 'detail']) for (const inverse of [false, true]) test(stage + ' direct and structured India/foreign contradiction ' + inverse + ' fails closed', async () => {
  const r = record(), d = detail(r), target = stage === 'listing' ? r : d
  target.country = inverse ? 'India' : 'US'; target.jobLocationRecord = [{ country: inverse ? 'United States' : 'India', formattedLocation: 'Bengaluru, India' }]
  await assert.rejects(run({ fetchJson: async url => url === source.LISTING_API_URL ? page([r]) : d }), /inventory|country/i)
})


test('final access failure retains only an already-incomplete nonempty fresh full-listing subset', async () => {
  for (const failure of [new Error('HTTP 403 for snapshot'), new Error('HTTP 429 for snapshot'), new Error('HTTP 503 for snapshot'), new DOMException('snapshot timed out', 'TimeoutError')]) {
    const r = record(); let listings = 0
    const jobs = await run({ fetchJson: async url => {
      if (url !== source.LISTING_API_URL) throw new Error('HTTP 403 for detail')
      if (++listings === 1) return page([r]); throw failure
    } })
    assert.equal(jobs.length, 1); assert.equal(jobs[0].country, 'India'); assert.equal(jobs[0].sourceListingComplete, false)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false); assert.equal(evidence.indiaFacetCount, null)
    assert.match(evidence.reason, /final-snapshot-unavailable/)
  }
})

test('final unavailable snapshot cannot certify complete or empty or excluded inventory', async () => {
  for (const kind of ['complete', 'empty', 'excluded']) {
    const r = record(); if (kind === 'excluded') { r.mediumDescriptionWithoutHtml = 'JD'; r.metaDescription = 'JD' }
    let listings = 0
    await assert.rejects(run({ fetchJson: async url => {
      if (url !== source.LISTING_API_URL) { if (kind === 'complete') return detail(r); throw new Error('HTTP 403 for detail') }
      if (++listings === 1) return page(kind === 'empty' ? [] : [r]); throw new Error('HTTP 403 for snapshot')
    } }), /HTTP 403/)
  }
})

test('partial descriptions never hide an actual malformed or changed final snapshot', async () => {
  for (const kind of ['malformed', 'title', 'country', 'status']) {
    const r = record(); let listings = 0
    await assert.rejects(run({ fetchJson: async url => {
      if (url !== source.LISTING_API_URL) throw new Error('HTTP 403 for detail')
      if (++listings === 1) return page([r])
      if (kind === 'malformed') return { message: 'HTTP 403 for snapshot' }
      const changed = clone(r)
      if (kind === 'title') changed.jobTitle = 'Changed title'
      if (kind === 'country') changed.jobLocationRecord[0].country = 'United States'
      if (kind === 'status') changed.status = 0
      return page([changed])
    } }), /inventory|snapshot|country|status/)
  }
})

test('partial final snapshot cancellation and unexpected transport failure remain fatal', async () => {
  for (const kind of ['cancel', 'unexpected']) {
    const r = record(), controller = new AbortController(); let listings = 0
    await assert.rejects(run({ signal: controller.signal, fetchJson: async url => {
      if (url !== source.LISTING_API_URL) throw new Error('HTTP 403 for detail')
      if (++listings === 1) return page([r])
      if (kind === 'cancel') { controller.abort(new Error('cancel snapshot')); throw new Error('HTTP 403 for snapshot') }
      throw new Error('unexpected programming failure')
    } }), kind === 'cancel' ? /cancel snapshot/ : /unexpected programming failure/)
  }
})

test('a capped counted traversal cannot use final transport fallback', async () => {
 const rows=[record(0),record(1),record(2)];let listings=0
 await assert.rejects(source.createInfoEdgeScraper({maxPages:1}).run({fetchJson:async url=>{
  if(url!==source.LISTING_API_URL)throw new Error('HTTP 403 for detail')
  if(++listings===1)return page(rows.slice(0,2),3,2)
  throw new Error('HTTP 403 for snapshot')
 }}),/HTTP 403/)
})

test('malformed JSON during final native response parsing remains fatal even with an HTTP-like message',async()=>{const r=record();let listings=0;await assert.rejects(run({fetchJson:async url=>{if(url!==source.LISTING_API_URL)throw new Error('HTTP 403 for detail');if(++listings===1)return page([r]);throw new SyntaxError('HTTP 403 malformed JSON')}}),SyntaxError)})

test('malformed native detail JSON mentioning HTTP403 cannot become a listing fallback',async()=>{const r=record();await assert.rejects(run({fetchJson:async url=>{if(url===source.LISTING_API_URL)return page([r]);return JSON.parse('HTTP 403 malformed native detail response')}}),SyntaxError)})

test('duplicate native application IDs across counted pages fail even when jobCodes differ',async()=>{for(const alias of [false,true]){const a=record(0),b=record(1);b.id=alias?'0'+a.id:a.id;await assert.rejects(run({fetchJson:async(url,options)=>{if(url!==source.LISTING_API_URL)throw new Error('HTTP 403 for detail');const offset=JSON.parse(options.form.filterCri).paginationStartNo;return page([offset===0?a:b],2,1,offset)}}),/duplicate.*(?:native|identity)/i)}})
