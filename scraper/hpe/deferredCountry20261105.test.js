import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers/promises'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createNativeDetailRecovery } from '../../scraper-support/utils/nativeDetailRecovery.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deferred-country-20261105.json.gz', import.meta.url))))
for (const sample of [fixture.search, ...fixture.samples, fixture.control]) {
  assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
}
const samples = new Map([...fixture.samples, fixture.control].map(sample => [sample.listing.reqId, sample]))
const detailBody = (sample, change) => {
  if (!change) return sample.body
  const model = extractPhAppDdo(sample.body)
  const postings = [...sample.body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]))
  change(model.jobDetail.data.job, postings.find(posting => posting['@type'] === 'JobPosting'))
  return '<link rel="canonical" href="' + sample.url + '"><script>phApp.ddo = '
    + JSON.stringify(model).replaceAll('<', '\\u003c') + '</script>'
    + postings.map(posting => '<script type="application/ld+json">' + JSON.stringify(posting).replaceAll('<', '\\u003c') + '</script>').join('')
}

// Raw rows and detail bodies are genuine captures. Only the test response's
// row subset/counts are reduced to isolate this boundary; these are not live
// inventory assertions. The registered source's real public run emits its
// native widget request and performs every production identity/scope check.
const replay = async (ids, { execute = run, change, changeListing, onDetail, ...options } = {}) => {
  const rows = ids.map(id => structuredClone(samples.get(id).listing))
  for (const row of rows) changeListing?.(row)
  return execute({ nativeDetailRecovery: false, detailEnrichmentBudgetMs: 1000, ...options,
    fetchJson: async (url, request) => {
      assert.equal(url, 'https://careers.hpe.com/widgets')
      assert.equal(request.method, 'POST')
      assert.deepEqual(JSON.parse(request.body).selected_fields, { country: ['India'] })
      return { refineSearch: { status: 200, totalHits: rows.length, hits: rows.length,
        data: { jobs: rows, aggregations: [{ field: 'country', value: { India: rows.length } }] } } }
    },
    fetchText: async (url, request) => {
      if (url === 'https://careers.hpe.com/us/en/search-results') return fixture.search.body
      const sample = [...samples.values()].find(sample => sample.url === url)
      assert.ok(sample, 'Only the captured role-owned detail may be requested')
      return onDetail ? onDetail(sample, request) : detailBody(sample, change)
    },
  })
}
const rejected = async (ids, options) => {
  try { return await replay(ids, options) } catch (error) {
    assert.equal(error.code, 'PHENOM_INCOMPLETE_SNAPSHOT')
    return []
  }
}

for (const id of ['1215856', '1216307', '1216306']) {
  test('HPE public run verifies the captured India secondary office behind a foreign primary for ' + id, async () => {
    const jobs = await rejected([id])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, id)
    assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].city, 'Bengaluru')
    assert.equal(jobs[0].location, 'Bengaluru, Karnātaka, India')
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0].sourceNativeCountryEvidence.country, id === '1215856' ? 'United States of America' : 'Mexico')
    assert.ok(jobs[0].jobDescription.length > 1000)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })
}

test('HPE keeps the captured placeholder office unresolved while retaining the other three explicit India offices', async () => {
  const jobs = await rejected(['1215856', '1212456', '1216307', '1216306'])
  assert.deepEqual(jobs.map(job => job.jobId), ['1215856', '1216307', '1216306'])
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
})

const india = job => job.multi_location.find(office => office.country === 'India')
for (const [name, change] of [
  ['conflicting typed India office country', job => { india(job).country = 'Canada' }],
  ['unknown typed India office country', job => { india(job).country = 'Unknownland' }],
  ['conflicting office city', job => { india(job).city = 'Mumbai' }],
  ['conflicting office state', job => { india(job).state = 'Gujarat' }],
  ['an unbound postal display', job => { india(job).location = 'Bengaluru, Karnātaka, 999999' }],
  ['unbound office coordinates', job => { india(job).latlong.lat = 1; india(job).latitude = '1' }],
  ['an inconsistent foreign primary office', job => { job.multi_location[0].country = 'India' }],
  ['a foreign-only role despite its India search facet', job => { job.multi_location = job.multi_location.filter(office => office.country !== 'India') }],
  ['a conflicting native requisition', job => { job.reqId = 'other-role' }],
  ['a conflicting native sequence', job => { job.jobSeqNo = 'other-sequence' }],
  ['a conflicting native title', job => { job.title = 'Other role' }],
  ['a conflicting JobPosting title', (_job, posting) => { posting.title = 'Other role' }],
  ['a conflicting explicit employer', (_job, posting) => { posting.hiringOrganization.name = 'Other Company' }],
  ['an absent explicit employer', (_job, posting) => { delete posting.hiringOrganization }],
  ['a conflicting application endpoint', job => { job.applyUrl = 'https://example.org/jobs/1215856/apply' }],
  ['a non-array native office collection', job => { job.multi_location_array = { country: 'Canada', location: 'Toronto, Ontario, Canada' } }],
  ['a string-valued native office collection', job => { job.multi_location_array = 'Toronto, Ontario, Canada' }],
  ['a malformed JSON-LD location collection', (_job, posting) => { posting.jobLocation = { unexpected: [posting.jobLocation] } }],
  ['absent full native content', (job, posting) => { job.ml_Description = ''; posting.description = '' }],
]) test('HPE deferred scope rejects ' + name, async () => {
  const jobs = await rejected(['1215856'], { change })
  assert.equal(jobs.length, 0)
})

test('other Phenom sources do not inherit HPE deferred country scope', async () => {
  const other = createPhenomScraper({ companyName: 'HPE', source: 'unopted-phenom', baseUrl: 'https://careers.hpe.com',
    searchPath: '/us/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
  assert.equal((await rejected(['1215856'], { execute: other.run })).length, 0)
})

for (const [name, changeListing] of [
  ['a conflicting primary full country', row => { row.cityStateCountry = 'Westford, Massachusetts, Canada' }],
  ['a conflicting supplied secondary country', row => { row.multi_location_array[1].country = 'Canada' }],
  ['an unknown supplied secondary country', row => { row.multi_location_array[1].country = 'Unknownland' }],
  ['a conflicting supplied secondary full country', row => { row.multi_location_array[1].cityStateCountry = 'Bengaluru, Karnātaka, Canada' }],
]) test('HPE cannot ignore changed native listing geography: ' + name, async () => {
  assert.equal((await rejected(['1215856'], { changeListing })).length, 0)
})

test('explicit zero detail budget never promotes the India facet or coordinates to workplace evidence', async () => {
  const jobs = await replay(['1215680', '1215856'], { detailEnrichmentBudgetMs: 0,
    onDetail: () => assert.fail('Zero budget cannot read any native detail') })
  assert.deepEqual(jobs.map(job => job.jobId), ['1215680'])
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a settled matching HPE scope receipt revalidates employer and exact owned office without another detail request', async () => {
  const recovery = createNativeDetailRecovery()
  const first = await rejected(['1215856'], { nativeDetailRecovery: recovery })
  assert.equal(first[0]?.sourceDetailComplete, true)
  const continued = await rejected(['1215856'], { nativeDetailRecovery: recovery,
    onDetail: () => assert.fail('An unchanged fresh verified receipt should be reused') })
  assert.equal(continued[0]?.sourceDetailFromRecovery, true)
  assert.equal(continued[0]?.country, 'India')
})

test('changed native listing office coordinates cannot reuse an earlier HPE scope receipt', async () => {
  const recovery = createNativeDetailRecovery()
  assert.equal((await rejected(['1215856'], { nativeDetailRecovery: recovery }))[0]?.sourceDetailComplete, true)
  let reads = 0
  const changed = await rejected(['1215856'], { nativeDetailRecovery: recovery,
    changeListing: row => { row.multi_location_array[1].latlong.lat = 1 },
    onDetail: sample => { reads++; return sample.body },
  })
  assert.equal(reads, 1)
  assert.equal(changed.length, 0)
})

test('external cancellation rejects HPE deferred hydration and a late response cannot write a recovery receipt', async () => {
  const recovery = createNativeDetailRecovery(), controller = new AbortController()
  let started, release
  const waiting = new Promise(resolve => { started = resolve })
  const pending = replay(['1215856'], { nativeDetailRecovery: recovery, signal: controller.signal,
    onDetail: (sample, request) => {
      started(request.signal)
      return new Promise(resolve => { release = () => resolve(sample.body) })
    },
  })
  const signal = await waiting
  controller.abort(new Error('Caller cancelled HPE'))
  await assert.rejects(pending, /Caller cancelled HPE/)
  assert.equal(signal.aborted, true)
  assert.equal(recovery.receipts.size, 0)
  release()
  await setImmediate()
  assert.equal(recovery.receipts.size, 0)
})

test('a detail budget expiry returns only known India rows and late deferred completion cannot mutate the result', async () => {
  const recovery = createNativeDetailRecovery()
  let release
  const jobs = await replay(['1215680', '1215856'], { nativeDetailRecovery: recovery,
    detailConcurrency: 1, detailEnrichmentBudgetMs: 25,
    onDetail: sample => new Promise(resolve => { release = () => resolve(sample.body) }),
  })
  assert.deepEqual(jobs.map(job => job.jobId), ['1215680'])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const before = JSON.stringify({ jobs, evidence: readInventoryEvidence(jobs), receipts: recovery.receipts.size })
  release()
  await setImmediate()
  assert.equal(JSON.stringify({ jobs, evidence: readInventoryEvidence(jobs), receipts: recovery.receipts.size }), before)
})
