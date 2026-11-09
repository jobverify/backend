import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper, extractNativeModel, extractPhAppDdo } from '../scraper-support/phenom/engine.js'
import { run as runOpenText } from '../scraper/opentext/script.js'

const html = gunzipSync(fs.readFileSync(new URL('./test-data/phenom/opentext-country-codes-20261107.html.gz', import.meta.url))).toString('utf8')
const boardURL = 'https://careers.opentext.com/us/en/search-results'
const factory = extra => createPhenomScraper({ companyName: 'OpenText', source: 'opentext-country-controls', baseUrl: 'https://careers.opentext.com', searchPath: '/us/en/search-results', scraperDir: fileURLToPath(new URL('../scraper/opentext/', import.meta.url)), ...extra })
const probe = async (run, body = html) => {
  const sentinel = Error('controlled stop after source computed the native widget request')
  const calls = []
  await assert.rejects(run({
    useWidgetApi: true,
    fetchText: async url => { assert.equal(url, boardURL); calls.push({ url, method: 'GET' }); return body },
    fetchJson: async (url, init) => {
      assert.equal(url, 'https://careers.opentext.com/widgets')
      assert.equal(init.method, 'POST')
      calls.push({ url, method: init.method, body: JSON.parse(init.body) })
      throw sentinel
    },
  }), error => error === sentinel)
  assert.equal(calls.length, 2)
  return calls[1].body
}
// These controls re-encode retained native data as controlled test HTML. Only
// the gzip above is an original unmodified HTTP body.
const controlledAggregation = countries => {
  const app = extractNativeModel(html, 'app'), ddo = structuredClone(extractPhAppDdo(html))
  const payload = ddo.eagerLoadRefineSearch
  const existing = payload.data?.aggregations ?? payload.aggregations
  if (Array.isArray(existing)) {
    const entry = existing.find(value => value.field === 'country')
    assert.ok(entry)
    entry.value = countries
  } else existing.country = countries
  return '<script>var phApp=phApp||' + JSON.stringify(app) + ';phApp.ddo=' + JSON.stringify(ddo) + ';</script>'
}

test('the OpenText country fixture is the entire original current public HTML body', () => {
  assert.equal(Buffer.byteLength(html), 86311)
  assert.equal(createHash('sha256').update(html).digest('hex'), 'bf82108610a2623753f0eb4a82818c4829cbeac09b3dc8e2eaa2297486244dbf')
  const payload = extractPhAppDdo(html).eagerLoadRefineSearch
  assert.equal(payload.totalHits, 369)
  assert.ok((payload.data?.jobs ?? payload.jobs).some(row => row.country === 'IND'))
})

test('OpenText registration requests the native IND country facet instead of the worldwide board', async () => {
  const request = await probe(runOpenText)
  assert.deepEqual(request.selected_fields, { country: ['IND'] })
  assert.equal(request.size, 100)
  assert.equal(request.country, 'us')
})

test('the explicit ISO alpha-3 option recognizes the genuine role-owned IND code', async () => {
  const request = await probe(factory({ nativeIsoAlpha3CountryCodes: true }).run)
  assert.deepEqual(request.selected_fields, { country: ['IND'] })
})

for (const extra of [{}, { nativeIsoAlpha3CountryCodes: false }]) {
  test('Phenom country-code opt-in leaves the previous default query unchanged: ' + JSON.stringify(extra), async () => {
    const request = await probe(factory(extra).run)
    assert.equal(Object.hasOwn(request, 'selected_fields'), false)
    assert.equal(request.size, 100)
  })
}

test('ISO alpha-3 recognition retains the native country spelling in the request', async () => {
  const request = await probe(factory({ nativeIsoAlpha3CountryCodes: true }).run, controlledAggregation({ ind: 27, CAN: 120 }))
  assert.deepEqual(request.selected_fields, { country: ['ind'] })
})

for (const label of ['NID', 'India Office', 'Bangalore', 'IND / USA', 'IND / UNKNOWN']) {
  test('country opt-in cannot turn a malformed, inferred or conflicting native label into India: ' + label, async () => {
    const request = await probe(factory({ nativeIsoAlpha3CountryCodes: true }).run, controlledAggregation({ [label]: 27, CAN: 120 }))
    assert.equal(Object.hasOwn(request, 'selected_fields'), false)
  })
}

test('a conflicting mixed-country alias does not hide a separately published native IND facet', async () => {
  const request = await probe(factory({ nativeIsoAlpha3CountryCodes: true }).run, controlledAggregation({ 'IND / USA': 5, IND: 27, CAN: 120 }))
  assert.deepEqual(request.selected_fields, { country: ['IND'] })
})

test('a detail-incomplete observation retains its original native IND country token', async () => {
  const payload = extractPhAppDdo(html).eagerLoadRefineSearch
  const raw = structuredClone((payload.data?.jobs ?? payload.jobs).find(row => row.country === 'IND'))
  // A controlled single-row response using an unmodified retained native row;
  // its count is synthetic and does not assert a current complete inventory.
  let calls = 0
  const jobs = await factory({ nativeIsoAlpha3CountryCodes: true }).run({
    useWidgetApi: true, detailEnrichmentBudgetMs: 0,
    fetchText: async url => { calls++; assert.equal(url, boardURL); return html },
    fetchJson: async (url, init) => {
      calls++
      assert.equal(url, 'https://careers.opentext.com/widgets')
      assert.deepEqual(JSON.parse(init.body).selected_fields, { country: ['IND'] })
      return { refineSearch: { status: 200, totalHits: 1, hits: 1, data: { jobs: [raw], aggregations: [{ field: 'country', value: { IND: 1 } }] } } }
    },
  })
  assert.equal(calls, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, raw.jobId)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceNativeCountryEvidence.listingCountry, 'IND')
  assert.deepEqual(jobs[0].sourceNativeCountryEvidence.nativeCountryCodeMappings, [{ code: 'IND', region: 'IN' }])
})

for (const value of [null, 1, 'true', [], { IND: 'IN' }]) {
  test('country opt-in accepts a boolean rather than caller-defined geography: ' + JSON.stringify(value), () => {
    assert.throws(() => factory({ nativeIsoAlpha3CountryCodes: value }), /ISO alpha-3.*boolean/)
  })
}

test('caller cancellation still prevents all reads when ISO country recognition is enabled', async () => {
  let calls = 0
  await assert.rejects(factory({ nativeIsoAlpha3CountryCodes: true }).run({
    signal: AbortSignal.abort(Error('caller stop')),
    fetchText: async () => { calls++; throw Error('unexpected read') },
  }), /caller stop/)
  assert.equal(calls, 0)
})
