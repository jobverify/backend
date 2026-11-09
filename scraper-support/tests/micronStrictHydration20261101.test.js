import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parse } from 'acorn'
import {
  buildMicronTechnologyIndiaApiProvider, createMicronTechnologyIndiaScraper,
  buildListingApiUrl, buildDetailApiUrl, OFFICIAL_CAREERS_URL, PROVIDER_METADATA, run,
} from '../../scraper/microntechnologyindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// These are the two unchanged native response bodies, not a complete inventory.
const pair = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/microntechnologyindia/native-captures/2026-11-01-native-pair.json.gz', import.meta.url))))
const listing = JSON.parse(pair.listingBody), detail = JSON.parse(pair.detailBody)
const record = listing.data.positions.find(row => row.id === detail.data.id)
const ast = parse(readFileSync(new URL('./micronTechnologyIndiaScript.test.js', import.meta.url), 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' })
const staticValue = node => node.type === 'Literal' ? node.value
  : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked
  : (() => { throw Error('Unsupported literal fixture') })()
const official = staticValue(ast.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === 'OFFICIAL_CAREERS_HTML').init)
const clone = value => structuredClone(value)
const hash = value => createHash('sha256').update(value).digest('hex')
// Explicitly synthetic bounded inventory: one exact observed native record.
// Neither count=1 nor this model's completion is attributed to the native315 feed.
const bounded = row => ({ status: listing.status, error: clone(listing.error), data: { positions: [clone(row)], count: 1 } })
const replay = async ({ row = record, payload = detail, error, requests = [] } = {}) => {
  const snapshots = []
  const jobs = await createMicronTechnologyIndiaScraper().run({
    fetchText: async url => { requests.push(url); assert.equal(url, OFFICIAL_CAREERS_URL); return official },
    fetchJson: async url => {
      requests.push(url)
      if (url === buildListingApiUrl()) return bounded(row)
      assert.equal(url, buildDetailApiUrl(row.id))
      if (error) throw error
      const value = clone(payload); snapshots.push([value, clone(value)]); return value
    },
  })
  for (const [value, snapshot] of snapshots) assert.deepEqual(value, snapshot)
  return { jobs, requests }
}

test('Micron retained raw pair preserves original bytes, partial315 count and distinct native publication clock', () => {
  for (const [label, body] of [['listing', pair.listingBody], ['detail', pair.detailBody]]) {
    const receipt = pair.observation.requests.find(request => request.label === label)
    assert.equal(Buffer.byteLength(body), receipt.bytes)
    assert.equal(hash(body), receipt.bodySHA256)
    assert.equal(receipt.status, 200)
  }
  assert.equal(listing.data.positions.length, 10)
  assert.equal(listing.data.count, 315)
  assert.equal(pair.observation.sourceInventoryOrAuthorityQualified, false)
  assert.equal(record.id, 44649782)
  assert.equal(record.displayJobId, 'JR113413')
  assert.equal(record.postedTs, 1792108800)
  assert.equal(record.creationTs, 1790294400)
  assert.notEqual(record.creationTs, record.postedTs)
  assert.equal(pair.observation.requests[0].requestedAt, '2026-11-01T14:30:34.980Z')
  assert.equal(pair.observation.requests[1].completedAt, '2026-11-01T14:30:36.802Z')
})

test('Micron strict internal provider uses the literally advertised native origin without replacing corporate metadata', () => {
  const provider = buildMicronTechnologyIndiaApiProvider()
  assert.equal(OFFICIAL_CAREERS_URL, 'https://in.micron.com/about/careers')
  assert.equal(PROVIDER_METADATA.companyCareerPage, OFFICIAL_CAREERS_URL)
  assert.equal(PROVIDER_METADATA.verifiedOn, '2026-08-04')
  assert.equal(provider.companyCareerPage, 'https://careers.micron.com/careers')
  assert.equal(provider.config.detail.enabled, true)
  assert.equal(provider.config.detail.requireListingIdentity, true)
  assert.equal(provider.config.mapping.location.strategy, 'eightfold-location')
  assert.equal(provider.config.mapping.country.strategy, 'eightfold-country')
})

test('Micron modeled one-role replay retains the exact captured fullJD, publication, identity, geography and authored application', async () => {
  const snapshot = clone({ listing, detail })
  const { jobs, requests } = await replay()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, record.id)
  assert.equal(job.requisitionId, record.displayJobId)
  assert.equal(job.title, record.name)
  assert.equal(job.company, PROVIDER_METADATA.companyName)
  assert.equal(job.source, PROVIDER_METADATA.source)
  assert.equal(job.location, record.locations[0])
  assert.equal(job.city, 'Hyderabad')
  assert.equal(job.country, 'India')
  assert.deepEqual(job.sourceNativeLocations, record.locations)
  assert.deepEqual(job.sourceStandardizedLocations, record.standardizedLocations)
  assert.equal(job.jobDescription, detail.data.jobDescription)
  assert.equal(job.jobDescription.length, 6855)
  assert.equal(job.sourceUrl, detail.data.publicUrl)
  assert.equal(job.applyUrl, detail.data.publicUrl)
  assert.equal(job.link, detail.data.publicUrl)
  assert.equal(job.department, record.department)
  assert.equal(job.employmentType, null)
  assert.equal(job.experienceRequired, '3+ years')
  assert.match(detail.data.jobDescription, /at least 3 years of experience/)
  assert.equal(job.minimumQualification, null)
  assert.equal(job.preferredQualification, null)
  assert.deepEqual(job.requiredSkills, [])
  assert.equal(job.remoteStatus, 'On-site')
  assert.ok(Number.isFinite(Date.parse(job.scrapedAt)))
  assert.equal(job.postingDate, '2026-10-16T00:00:00.000Z')
  assert.notEqual(job.postingDate, new Date(record.creationTs * 1000).toISOString())
  assert.equal(job.publicExperienceChecked, true)
  assert.deepEqual(requests, [OFFICIAL_CAREERS_URL, buildListingApiUrl(), buildDetailApiUrl(record.id)])
  assert.deepEqual({ listing, detail }, snapshot)
})

for (const field of ['id', 'displayJobId', 'name']) {
  test('Micron captured-detail identity rejects contradictory native ' + field, async () => {
    const payload = clone(detail); payload.data[field] = field === 'id' ? record.id + 1 : 'controlled contradiction'
    await assert.rejects(replay({ payload }), error => error.incompleteScope === true && /identity mismatch/.test(error.message))
  })
}
for (const [name, change] of [
  ['raw location', value => { value.data.locations = ['Boise, Idaho, United States'] }],
  ['standardized foreign country', value => { value.data.standardizedLocations = ['Hyderabad, TS, US'] }],
  ['positionURL ID', value => { value.data.positionUrl = '/careers/job/44649783' }],
]) {
  test('Micron captured-detail identity rejects conflicting ' + name, async () => {
    const payload = clone(detail); change(payload)
    await assert.rejects(replay({ payload }), error => error.incompleteScope === true)
  })
}

for (const publicUrl of [undefined, '/careers/job/44649782', 'http://careers.micron.com/careers/job/44649782',
  'https://foreign.example/careers/job/44649782', 'https://careers.micron.com/careers/job/44649783',
  'https://name@careers.micron.com/careers/job/44649782', 'https://careers.micron.com/careers/job/44649782?other=1',
  'https://careers.micron.com/careers/job/44649782#other']) {
  test('Micron rejects unbound native publicURL: ' + String(publicUrl), async () => {
    const payload = clone(detail); payload.data.publicUrl = publicUrl
    await assert.rejects(replay({ payload }), error => error.incompleteScope === true && /publicUrl/.test(error.message))
  })
}

test('Micron optional missing fullJD retains the native listing role with explicit partial detail evidence', async () => {
  const payload = clone(detail); delete payload.data.jobDescription
  const { jobs, requests } = await replay({ payload })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, record.id)
  assert.ok(jobs[0].jobDescription == null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.match(readInventoryEvidence(jobs).reason, /optional-role-details-unavailable/)
  assert.equal(requests.length, 3)
})

test('Micron native location strategy does not turn an unresolved city-only country into an India role', async () => {
  const row = clone(record), payload = clone(detail)
  row.locations = ['Hyderabad']; delete row.standardizedLocations
  payload.data.locations = clone(row.locations); delete payload.data.standardizedLocations
  const { jobs } = await replay({ row, payload })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
})

test('Micron explicit foreign raw and standardized country remains foreign in a controlled location-only variant', async () => {
  const row = clone(record), payload = clone(detail)
  row.locations = ['Boise, Idaho, United States']; row.standardizedLocations = ['Boise, ID, US']
  payload.data.locations = clone(row.locations); payload.data.standardizedLocations = clone(row.standardizedLocations)
  const { jobs } = await replay({ row, payload })
  assert.equal(jobs.length, 0)
})

test('Micron listing raw-vs-standardized foreign contradiction stops before reading a detail', async () => {
  const row = clone(record); row.standardizedLocations = ['Hyderabad, TS, US']
  const requests = []
  await assert.rejects(replay({ row, requests }), error => error.incompleteScope === true && /native country/.test(error.message))
  assert.deepEqual(requests, [OFFICIAL_CAREERS_URL, buildListingApiUrl()])
})

test('Micron malformed request-ID query cannot create a second native identity read', async () => {
  const row = clone(record), requests = []
  row.id = String(row.id) + '&position_id=' + String(row.id + 1)
  await assert.rejects(replay({ row, requests }), error => error.incompleteScope === true && /publicUrl/.test(error.message))
  assert.deepEqual(requests, [OFFICIAL_CAREERS_URL, buildListingApiUrl()])
})

test('Micron injected fatal transport error retains its exact opaque identity without a fallback read', async () => {
  const reason = Object.freeze(Object.assign(new Error('controlled fatal detail unavailable'), { incompleteScope: true }))
  const requests = []
  await assert.rejects(replay({ error: reason, requests }), error => error === reason)
  assert.deepEqual(requests, [OFFICIAL_CAREERS_URL, buildListingApiUrl(), buildDetailApiUrl(record.id)])
})

for (const status of [401, 403, 429]) {
  test('Micron default detail HTTP' + status + ' has no browser retry and retains an honestly partial observed role', async t => {
    const browserCalls = [], directCalls = []; let closes = 0
    t.mock.method(globalThis, 'fetch', async url => {
      directCalls.push(String(url)); assert.equal(String(url), buildDetailApiUrl(record.id))
      return new Response('controlled denial', { status })
    })
    const scraper = createMicronTechnologyIndiaScraper({ createBrowserFetchSessionImpl: async () => ({
      fetchText: async url => { browserCalls.push(url); assert.equal(url, buildListingApiUrl()); return JSON.stringify(bounded(record)) },
      close: async () => { closes++ },
    }) })
    const jobs = await scraper.run({ fetchText: async url => { assert.equal(url, OFFICIAL_CAREERS_URL); return official } })
    // Only native 429s receive the two bounded portal retries; denial statuses
    // still make one direct request and never trigger browser detail recovery.
    assert.deepEqual(directCalls, Array.from({ length: status === 429 ? 3 : 1 }, () => buildDetailApiUrl(record.id)))
    assert.deepEqual(browserCalls, [buildListingApiUrl()])
    assert.equal(closes, 1)
    assert.equal(jobs.length, 1)
    assert.ok(jobs[0].jobDescription == null)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  })
}

const deferred = () => {
  let resolve
  const promise = new Promise(value => { resolve = value })
  return { promise, resolve }
}
const outcome = async promise => {
  let timer
  try {
    return await Promise.race([
      promise.then(value => ({ kind: 'resolved', value }), reason => ({ kind: 'rejected', reason })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ kind: 'pending' }), 300) }),
    ])
  } finally { clearTimeout(timer) }
}
const reasonVariants = [
  ['frozen Error', () => Object.freeze(new Error('Controlled HTTP403 caller stop'))],
  ['frozen object', () => Object.freeze({ code: 'controlled stop', surface: 'not-upstream' })],
  ['string', () => 'Controlled caller string'],
  ['null', () => null],
  ['default', () => undefined],
  ['opaque throwing getters', () => Object.freeze(Object.defineProperties({}, {
    code: { get() { throw Error('caller code must remain opaque') } },
    surface: { get() { throw Error('caller surface must remain opaque') } },
    message: { get() { throw Error('caller message must remain opaque') } },
  }))],
]

for (const [name, makeReason] of reasonVariants) {
  test('Micron pre-aborted caller makes zero reads and preserves exact ' + name, async () => {
    const controller = new AbortController(); controller.abort(makeReason())
    let calls = 0
    const result = await outcome(createMicronTechnologyIndiaScraper().run({
      signal: controller.signal,
      fetchText: async () => { calls++; return official },
      fetchJson: async url => { calls++; return url === buildListingApiUrl() ? bounded(record) : clone(detail) },
    }))
    assert.equal(result.kind, 'rejected')
    assert.equal(Object.is(result.reason, controller.signal.reason), true)
    assert.equal(calls, 0)
  })

  test('Micron noncooperative default detail settles caller abort without retry for ' + name, async t => {
    const controller = new AbortController(), entered = deferred(), browserCalls = [], directCalls = []
    let detailSignal, listingSignal, closes = 0
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      directCalls.push(String(url)); detailSignal = options.signal; entered.resolve()
      return new Promise(() => {}) // Deliberately synthetic noncooperative I/O.
    })
    const scraper = createMicronTechnologyIndiaScraper({ createBrowserFetchSessionImpl: async () => ({
      fetchText: async (url, options) => {
        browserCalls.push(url); listingSignal = options.signal
        assert.equal(url, buildListingApiUrl()); return JSON.stringify(bounded(record))
      },
      close: async () => { closes++ },
    }) })
    const pending = scraper.run({ signal: controller.signal, fetchText: async () => official })
    const boundedResult = outcome(pending)
    await entered.promise
    controller.abort(makeReason())
    const result = await boundedResult
    assert.equal(result.kind, 'rejected')
    assert.equal(Object.is(result.reason, controller.signal.reason), true)
    assert.equal(detailSignal?.aborted, true)
    assert.equal(Object.is(detailSignal.reason, controller.signal.reason), true)
    assert.equal(listingSignal?.aborted, true)
    assert.deepEqual(directCalls, [buildDetailApiUrl(record.id)])
    assert.deepEqual(browserCalls, [buildListingApiUrl()])
    assert.equal(closes, 1)
  })
}

test('Micron exported source run forwards pre-aborted context before using default HTTP', async t => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Controlled exported caller stop'))
  controller.abort(reason); let calls = 0
  const stop = Object.assign(new Error('Unexpected controlled default HTTP'), { abortRetries: true })
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw stop })
  const result = await outcome(run({ signal: controller.signal, fetchText: async () => { calls++; return official } }))
  assert.equal(result.kind, 'rejected')
  assert.equal(Object.is(result.reason, reason), true)
  assert.equal(calls, 0)
})

test('Micron noncooperative official-page read cannot start a later listing after caller abort', async () => {
  const controller = new AbortController(), entered = deferred(), late = deferred()
  const reason = Object.freeze({ controlled: 'homepage caller stop' }), calls = []
  const resultPromise = outcome(createMicronTechnologyIndiaScraper().run({
    signal: controller.signal,
    fetchText: async url => { calls.push(url); entered.resolve(); return late.promise },
    fetchJson: async url => { calls.push(url); return url === buildListingApiUrl() ? bounded(record) : clone(detail) },
  }))
  await entered.promise; controller.abort(reason)
  const result = await resultPromise
  assert.equal(result.kind, 'rejected')
  assert.equal(Object.is(result.reason, reason), true)
  late.resolve(official); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, [OFFICIAL_CAREERS_URL])
})
