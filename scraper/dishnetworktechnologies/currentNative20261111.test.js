import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json', import.meta.url), 'utf8'))
const captures = new Map(manifest.receipts.map(receipt => [receipt.requestedURL, { ...receipt,
  body: gunzipSync(readFileSync(new URL('./fixtures/' + receipt.fixture, import.meta.url))).toString('utf8') }]))
const api = manifest.receipts.find(receipt => receipt.fixture === 'native-api-page-1-20261111.gz').requestedURL
const INDIA = 'https://echostar.com/careers/locations/india'
const ROLE = 'https://jobs.echostar.com/jobs/98606?lang=en-us'
const CLIENT = 'https://app.jibecdn.com/prod/descriptions/1.1.100/main.js'
const SEARCH = manifest.receipts.find(receipt => receipt.fixture === 'native-search-20261111.gz').requestedURL
const jsonChange = (body, change) => { const payload = JSON.parse(body); change(payload); return JSON.stringify(payload) }
const replaceCaptured = (body, before, after) => {
  const changed = body.replaceAll(before, after)
  assert.notEqual(changed, body, 'the intended actual native fixture literal was changed')
  return changed
}
const schemaChange = (html, change) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (all, start, body, end) => { const record = JSON.parse(body); return record['@type'] === 'JobPosting' ? start + JSON.stringify(change(record)) + end : all })

function publisher(t, mutate = value => value) {
  const counts = new Map(), reads = []
  t.mock.method(globalThis, 'fetch', async (value, init) => {
    const url = String(value), packet = captures.get(url)
    assert.ok(packet, 'Only actual captured currently declared public requests are permitted: ' + url)
    const occurrence = (counts.get(url) || 0) + 1
    counts.set(url, occurrence)
    const result = mutate({ url, occurrence, body: packet.body, status: 200, init })
    reads.push({ url, init })
    const response = new Response(result.body, { status: result.status, headers: { 'content-type': packet.headers['content-type'] } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return { counts, reads }
}

test('the current corporate India declaration and native Jibe models recover four actual India roles with exact original full criteria', async t => {
  const { counts, reads } = publisher(t)
  const jobs = await run()
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map(job => job.jobId), ['98606', '97540', '95713', '97514'])
  assert.ok(jobs.every(job => job.company === 'EchoStar' && job.sourceConfiguredCompanyName === 'DISH Network Technologies'
    && job.country === 'India' && job.sourceDetailComplete === true && job.sourceScopeComplete === false))
  assert.equal(jobs[0].title, 'Lead Engineer - AWS Cloud')
  assert.equal(jobs[0].sourceDescription.length, 9184)
  assert.equal(jobs[0].sourceDescription, jobs[0].nativeJobPosting.description)
  assert.equal(jobs[0].sourceDescription, jobs[0].nativeDetailRecord.description)
  assert.equal(jobs[0].sourceDescription, jobs[0].nativeRenderedDescription)
  assert.equal(jobs[0].postingDate, '2026-05-26T04:59:00+0000')
  assert.equal(jobs[0].closingDate, null)
  assert.equal(jobs[0].sourceClosingDateIsExact, false)
  assert.equal(jobs[0].legalEmployer, null)
  assert.deepEqual(jobs[1].additionalLocations, [{ city: 'Hyderabad', country: 'India' }])
  assert.equal(jobs[1].nativeListingRecord.data.additional_locations[0].country_code, 'IN')
  assert.equal(jobs[1].nativeListingRecord.data.additional_locations[0].postal_code, '500081')
  assert.equal(jobs[0].applyUrl, 'https://india-external-dish.icims.com/jobs/98606/login')
  assert.equal(jobs[0].nativeCriteriaRepresentations.plainTextAndFullHtmlEqual, true)
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 10)
  assert.equal(jobs[0].nativeCollectionEvidence.nativeReportedSearchCount, 28)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, true)
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, 'dishnetworktechnologies').observedRecordCount, 10)
  assert.equal(readSourceObservationEvidence(jobs, 'dishnetworktechnologies').companyIndiaTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(counts.get(ROLE), 2)
  assert.equal(counts.get(CLIENT), 2)
  assert.equal(counts.get(api), 2)
  assert.equal(reads.length, 22)
})

for (const [name, modify, reason] of [
  ['an absent explicit work country', p => { delete p.jobs[0].data.country }, /country/i],
  ['a country label contradicting its country code', p => { p.jobs[0].data.country = 'United States' }, /country/i],
  ['a different native employer', p => { p.jobs[0].data.hiring_organization = 'Another Company' }, /employer/i],
  ['changed published punctuation in full criteria', p => { p.jobs[0].data.description = p.jobs[0].data.description.replace('9+ years', '9 years') }, /criteria/i],
  ['a repeated native listing identity', p => { p.jobs[1] = structuredClone(p.jobs[0]) }, /duplicate|identity/i],
]) test('current native collection rejects ' + name, async t => {
  publisher(t, value => value.url === api ? { ...value, body: jsonChange(value.body, modify) } : value)
  await assert.rejects(run(), reason)
})

for (const [name, change, reason] of [
  ['a schema-only different full description', p => ({ ...p, description: p.description + '<p>Unrelated mandatory criteria.</p>' }), /criteria/i],
  ['a different schema title', p => ({ ...p, title: 'Unrelated Role' }), /title|identity/i],
  ['a different schema employer', p => ({ ...p, hiringOrganization: { name: 'Different Employer' } }), /employer/i],
  ['a different schema country', p => ({ ...p, jobLocation: { address: { addressCountry: 'US' } } }), /country|location/i],
]) test('an individually published native role rejects ' + name, async t => {
  publisher(t, value => value.url === ROLE ? { ...value, body: schemaChange(value.body, change) } : value)
  await assert.rejects(run(), reason)
})

test('a hidden own-role rendering component cannot authorize the active config text', async t => {
  publisher(t, value => value.url === ROLE ? { ...value,
    body: value.body.replace('<descriptions-app ', '<descriptions-app hidden ') } : value)
  await assert.rejects(run(), /component|render/i)
})

test('an unreviewed current full-description renderer cannot authorize the native config', async t => {
  publisher(t, value => value.url === CLIENT ? { ...value, body: value.body + '\n// changed current renderer' } : value)
  await assert.rejects(run(), /renderer|client/i)
})

test('a changed closing selected native full role withholds every staged job', async t => {
  publisher(t, value => value.url === ROLE && value.occurrence === 2 ? { ...value,
    body: value.body.replaceAll('9+ years', '10+ years') } : value)
  await assert.rejects(run(), /criteria|closing/i)
})

test('a changed closing native page withholds every staged job', async t => {
  publisher(t, value => value.url === api && value.occurrence === 2 ? { ...value,
    body: jsonChange(value.body, p => { p.jobs[0].data.title = 'Changed Current Title' }) } : value)
  await assert.rejects(run(), /closing.*inventory|inventory.*changed/i)
})

test('an additional city without its explicit country cannot inherit the primary India country', async t => {
  const role = 'https://jobs.echostar.com/jobs/97540?lang=en-us'
  publisher(t, value => {
    if (value.url !== role) return value
    const body = value.body.replaceAll('"city":"Hyderabad","country":"India"', '"city":"Hyderabad"')
    assert.notEqual(body, value.body, 'actual compact additional-country fixture was changed')
    return { ...value, body }
  })
  await assert.rejects(run(), /country|location/i)
})

test('a real schema postal code contradicting its native city record stays unresolved', async t => {
  const role = 'https://jobs.echostar.com/jobs/97540?lang=en-us'
  publisher(t, value => value.url === role ? { ...value, body: schemaChange(value.body, p => {
    p.jobLocation[1].address.postalCode = '999999'
    return p
  }) } : value)
  await assert.rejects(run(), /country|location|postal/i)
})

test('a removed closing current branded India handoff withholds every staged job', async t => {
  publisher(t, value => value.url === INDIA && value.occurrence === 2 ? { ...value,
    body: value.body.replaceAll('jobs.echostar.com', 'unrelated.example') } : value)
  await assert.rejects(run(), /handoff|declaration/i)
})

test('a bounded partial result retains every observed native row and omitted-detail caveat', async t => {
  publisher(t)
  const jobs = await run({ maxDetails: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 10)
  assert.equal(jobs[0].nativeCollectionEvidence.omittedDetails, 3)
  assert.equal(jobs[0].nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('a current empty public native response remains unknown rather than verified zero', async t => {
  publisher(t, value => value.url === api ? { ...value, body: jsonChange(value.body, p => { p.jobs = []; p.totalCount = 0; p.count = 0 }) } : value)
  await assert.rejects(run(), /empty|zero|unavailable/i)
})

test('matching typed India fields cannot erase contradictory displayed full location countries', async t => {
  publisher(t, value => {
    if (value.url === api) return { ...value, body: jsonChange(value.body, p => { p.jobs[0].data.full_location = 'Hyderabad, United States' }) }
    if (value.url === ROLE) return { ...value, body: replaceCaptured(value.body,
      '"full_location":"Hyderabad, India"', '"full_location":"Hyderabad, United States"') }
    return value
  })
  await assert.rejects(run(), /country|location/i)
})

test('a contradictory formatted location cannot override the typed India fields', async t => {
  publisher(t, value => value.url === ROLE ? { ...value, body: replaceCaptured(value.body,
    '"location":"Hyderabad, India"', '"location":"Hyderabad, United States"') } : value)
  await assert.rejects(run(), /country|location/i)
})

test('the full displayed list of additional work locations must match explicit native countries', async t => {
  const role = 'https://jobs.echostar.com/jobs/97540?lang=en-us'
  publisher(t, value => {
    if (value.url === api) return { ...value, body: jsonChange(value.body, p => { p.jobs[1].data.full_location = 'Bengaluru, India; Hyderabad, United States' }) }
    if (value.url === role) return { ...value, body: replaceCaptured(value.body,
      '"full_location":"Bengaluru, India; Hyderabad, India"', '"full_location":"Bengaluru, India; Hyderabad, United States"') }
    return value
  })
  await assert.rejects(run(), /country|location/i)
})

test('an additional published location label cannot contradict its explicit country using an ISO code', async t => {
  publisher(t, value => value.url === api ? { ...value, body: jsonChange(value.body, p => {
    p.jobs[1].data.additional_locations[0].location_name = 'Hyderabad, US'
  }) } : value)
  await assert.rejects(run(), /country|location/i)
})

test('a US location alias cannot use a different country code as an unreviewed state abbreviation', async t => {
  publisher(t, value => value.url === api ? { ...value, body: jsonChange(value.body, p => {
    p.jobs[4].data.location_name = 'Detroit, GB'
  }) } : value)
  await assert.rejects(run(), /country|location/i)
})

for (const [name, url, before, after] of [
  ['tenant account', SEARCH, '"cid":"dish"', '"cid":"another-tenant","cid":"dish"'],
  ['own role identity', ROLE, '"slug":"98606"', '"slug":"99999","slug":"98606"'],
  ['own role country', ROLE, '"country":"India"', '"country":"United States","country":"India"'],
  ['listing country', api, '"country":"India"', '"country":"United States","country":"India"'],
]) test('a duplicate native ' + name + ' key cannot erase an earlier conflicting declaration', async t => {
  publisher(t, value => value.url === url ? { ...value, body: replaceCaptured(value.body, before, after) } : value)
  await assert.rejects(run(), /duplicate.*key|key.*duplicate/i)
})
