import assert from 'node:assert/strict'
import test from 'node:test'
import * as aci from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'

const corporate = '<title>Careers | ACI Worldwide</title><p>ACI powers the global economy.</p><p>Every person at ACI makes an impact on payments around the world.</p><a href="https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/">Explore Opportunities</a>'
const candidate = '<title>ACI Worldwide Job Opportunities</title><meta property="og:title" content="ACI Worldwide Job Opportunities Careers"><meta property="og:description" content="JOIN OUR TEAM"><base href="/hcmUI/CandidateExperience/en/sites/CX" data-apibaseurl="https://ebwg.fa.us2.oraclecloud.com:443" data-sitenumber="CX">'
const row = (id, extra = {}) => ({ Id: String(id), Title: 'Payments Engineer ' + id,
  PrimaryLocationCountry: 'IN', PrimaryLocation: 'Pune, Maharashtra, India', secondaryLocations: [], ...extra })
const detail = record => ({ ...record, ExternalDescriptionStr: '<p>Build reliable global payment systems.</p>',
  ExternalResponsibilitiesStr: '<ul><li>Own system design and production reliability.</li></ul>',
  ExternalQualificationsStr: '<p>Experience with distributed transactions is required.</p>', ShortDescriptionStr: 'Summary only.' })
const fixture = (records, options = {}) => {
  const requests = [], totals = [records.length], text = async (url, init) => {
    requests.push({ url, init })
    if (url === aci.CORPORATE_CAREERS_URL) return options.corporate ?? corporate
    if (url === aci.CANDIDATE_EXPERIENCE_URL) return candidate
    if (url === 'https://www.aciworldwide.com/about-aci/careers/technology-operations') return corporate
    throw Error('Unexpected public text URL ' + url)
  }
  let openings = 0
  const json = async (url, init) => {
    requests.push({ url, init })
    if (url.startsWith(aci.LISTING_API_BASE_URL + '?')) {
      assert.match(url, /,location=$/, 'the collector must enumerate the global native inventory')
      const offset = Number(url.match(/,offset=(\d+)/)?.[1])
      if (offset === 0) openings++
      const current = options.closingRecords && openings > 1 ? options.closingRecords : records
      return { items: [{ Offset: offset, Limit: 24, SiteNumber: 'CX', Location: null,
        TotalJobsCount: options.total ?? current.length, requisitionList: current.slice(offset, offset + 24) }] }
    }
    const id = url.match(/Id=%22(\d+)%22/)?.[1]
    const record = records.find(record => String(record.Id) === id)
    assert.ok(record, 'detail must belong to the native inventory')
    return options.detail ? options.detail(record, init) : { items: [detail(record)] }
  }
  return { requests, totals, options: { fetchText: text, fetchJson: json, now: () => '2026-11-05T08:30:00.000Z' } }
}

// Break caught: inheriting the central ten-page cap or filtering before raw pagination.
test('ACI enumerates and reconciles every global native offset before projecting India', async () => {
  const foreign = Array.from({ length: 240 }, (_, i) => row(10000 + i, {
    PrimaryLocationCountry: 'US', PrimaryLocation: 'Norcross, GA, United States' }))
  const f = fixture([...foreign, row(20200)])
  const jobs = await aci.run(f.options)
  assert.deepEqual(jobs.map(job => job.jobId), ['20200'])
  assert.equal(f.requests.filter(request => request.url.startsWith(aci.LISTING_API_BASE_URL)).length, 22)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 241)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, true)
  assert.equal(extractionDetailHealth(jobs).nativeCollections[0].observedListingRows, 241)
})

// Break caught: using the foreign primary display location or ignoring secondary CountryCode.
test('ACI uses the typed India secondary worksite and retains every authored detail section', async () => {
  const f = fixture([row(20201, { PrimaryLocationCountry: 'US', PrimaryLocation: 'United States',
    secondaryLocations: [{ CountryCode: 'IN', Name: 'Bangalore' }] })])
  const jobs = await aci.run(f.options)
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /Experience with distributed transactions is required\./)
  assert.match(jobs[0].jobDescription, /Own system design and production reliability\./)
  assert.doesNotMatch(jobs[0].jobDescription, /Summary only/)
  assert.equal(jobs[0].sourceDescription, jobs[0].jobDescription)
})

test('ACI rejects overlapping native identities before fetching any details', async () => {
  const f = fixture([row(20201), row(20201)])
  await assert.rejects(aci.run(f.options), error => error.failureKind === 'upstream_inventory_changed')
  assert.equal(f.requests.filter(request => request.url.startsWith(aci.DETAIL_API_BASE_URL)).length, 0)
})

test('ACI rejects a native inventory changed during detail hydration', async () => {
  const f = fixture([row(20201)], { closingRecords: [row(20202)] })
  await assert.rejects(aci.run(f.options), error => error.failureKind === 'upstream_inventory_changed')
})

test('ACI leaves an unknown native country incomplete instead of proving zero India jobs', async () => {
  const f = fixture([row(20201, { PrimaryLocationCountry: null, PrimaryLocation: 'Bangalore' })])
  const jobs = await aci.run(f.options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readSourceObservationEvidence(jobs, aci.SOURCE).observedVacancyCount, 1)
})

test('ACI marks summary-only detail content incomplete and prevents lifecycle cleanup', async () => {
  const f = fixture([row(20201)], { detail: record => ({ items: [{ ...record,
    ShortDescriptionStr: 'Summary only.', ExternalDescriptionStr: null,
    ExternalResponsibilitiesStr: null, ExternalQualificationsStr: null }] }) })
  const jobs = await aci.run(f.options)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(extractionDetailHealth(jobs).complete, false)
})

test('ACI preserves raw observations and incomplete health through the registered provider map', async () => {
  const { buildScrapers } = await import('../../scraper-support/providers/index.js')
  const scraper = buildScrapers().find(scraper => scraper.name === aci.SOURCE)
  const f = fixture([row(20201), row(20202)])
  const jobs = await scraper.run({ ...f.options, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, aci.SOURCE).observedVacancyCount, 2)
  assert.deepEqual(extractionRawJobMetrics({ source: aci.SOURCE }, jobs, readInventoryEvidence(jobs)),
    { rawJobs: 2, rawJobsBasis: 'inventory-reported-total' })
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('ACI checks linked corporate careers scopes and refuses to promote unknown delegation', async () => {
  const f = fixture([row(20201)], { corporate: corporate
    + '<a href="/about-aci/careers/technology-operations">Technology careers</a>'
    + '<a href="https://other-employer.example/jobs">View jobs</a>' })
  const jobs = await aci.run(f.options)
  assert.equal(f.requests.filter(request => request.url.endsWith('/technology-operations')).length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(f.requests.some(request => request.url.startsWith('https://other-employer.example')), false)
})

test('ACI preserves the caller exact cancellation reason when a custom fetch ignores its signal', async () => {
  const controller = new AbortController(), reason = { stop: 'caller abort' }
  let started
  const ready = new Promise(resolve => { started = resolve })
  const run = aci.run({ signal: controller.signal, fetchText: async (_url, init) => {
    started()
    assert.ok(init?.signal)
    return new Promise(() => {})
  } })
  await ready
  controller.abort(reason)
  await assert.rejects(run, error => error === reason)
})

test('ACI bounds an ignored default fetch and an ignored response body', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => ({ status: 200,
    headers: new Headers({ 'content-type': 'text/html' }), url: aci.CORPORATE_CAREERS_URL,
    text: () => new Promise(() => {}) })]) {
    await assert.rejects(aci.run({ fetchImpl, requestTimeoutMs: 15, sourceTimeoutMs: 200 }),
      error => error.code === 'ACI_REQUEST_TIMEOUT')
  }
})

test('ACI enforces source, request and response byte bounds before later requests', async () => {
  const f = fixture([row(20201)])
  await assert.rejects(aci.run({ ...f.options, maxRequests: 1 }), error => error.code === 'ACI_REQUEST_LIMIT')
  assert.equal(f.requests.length, 1)
  await assert.rejects(aci.run({ ...fixture([row(20201)]).options, maxResponseBytes: 80 }),
    error => error.code === 'ACI_RESPONSE_LIMIT')
  await assert.rejects(aci.run({ sourceTimeoutMs: 15, requestTimeoutMs: 200,
    fetchText: () => new Promise(() => {}) }), error => error.code === 'ACI_SOURCE_TIMEOUT')
})

test('ACI stops queued detail work and settles active bounded readers after a fatal identity conflict', async () => {
  const started = []
  let release
  const blocked = new Promise(resolve => { release = resolve })
  const f = fixture([row(20201), row(20202), row(20203)], { detail: async record => {
    started.push(record.Id)
    if (record.Id === '20201') return { items: [detail(row(99999))] }
    await blocked
    return { items: [detail(record)] }
  } })
  await assert.rejects(aci.run({ ...f.options, detailConcurrency: 2 }),
    error => error.failureKind === 'upstream_contract_changed')
  assert.deepEqual(started, ['20201', '20202'])
  release()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(started, ['20201', '20202'])
})

test('ACI refuses a conflicting typed native country rather than using the India query or city', async () => {
  const f = fixture([row(20201, { PrimaryLocationCountry: 'US' })])
  await assert.rejects(aci.run(f.options), error => error.failureKind === 'upstream_contract_changed')
})

test('ACI retains the global count when a reconciled inventory contains no India roles', async () => {
  const f = fixture([row(20201, { PrimaryLocationCountry: 'US', PrimaryLocation: 'United States' })])
  const jobs = await aci.run(f.options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('ACI accepts an empty inventory only after two current global reads and delegation checks', async () => {
  const f = fixture([])
  const jobs = await aci.run(f.options)
  assert.equal(f.requests.length, 6)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('ACI follows sparse native offsets and retains their unreconciled raw count', async () => {
  const f = fixture(Array.from({ length: 25 }, (_, i) => row(20200 + i)))
  const json = f.options.fetchJson
  f.options.fetchJson = async (url, init) => {
    const payload = await json(url, init)
    if (url.startsWith(aci.LISTING_API_BASE_URL) && url.includes('offset=0,')) payload.items[0].requisitionList.splice(1)
    return payload
  }
  const jobs = await aci.run(f.options)
  assert.deepEqual(jobs.map(job => job.jobId), ['20200', '20224'])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 25)
  assert.equal(readInventoryEvidence(jobs).reason, 'native-inventory-count-unreconciled')
  assert.equal(readSourceObservationEvidence(jobs, aci.SOURCE).observedVacancyCount, 2)
  assert.equal(extractionDetailHealth(jobs).nativeCollections[0].closingInventoryMatches, true)
})

test('ACI recognizes advertised keyword searches on the verified CX site as views of the global inventory', async () => {
  const f = fixture([row(20201)], { corporate: corporate
    + '<a href="https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/requisitions?keyword=Software+Engineer&amp;mode=location">Software Engineer</a>' })
  const jobs = await aci.run(f.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, true)
  assert.equal(f.requests.some(request => request.url.includes('/requisitions?')), false)
})

test('ACI keeps unreviewed site parameters and keyword search filters outside the proven global scope', async () => {
  for (const suffix of ['?siteNumber=CX_9', '/requisitions?keyword=Payments&siteNumber=CX_9']) {
    const f = fixture([row(20201)], { corporate: corporate
      + '<a href="https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX'
      + suffix + '">View jobs</a>' })
    const jobs = await aci.run(f.options)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  }
})

test('ACI refuses a filtered or wrong-site native response even if its query URL is global', async () => {
  for (const fields of [{ SiteNumber: 'OTHER' }, { Location: 'India' }, { Offset: 24 }, { Limit: 25 },
    { SelectedLocationsFacet: 'IN' }]) {
    const f = fixture([row(20201)]), json = f.options.fetchJson
    f.options.fetchJson = async (url, init) => {
      const payload = await json(url, init)
      if (url.startsWith(aci.LISTING_API_BASE_URL)) Object.assign(payload.items[0], fields)
      return payload
    }
    await assert.rejects(aci.run(f.options), error => error.failureKind === 'upstream_contract_changed')
  }
})

test('ACI does not turn script-only authored fields into a usable source description', async () => {
  const f = fixture([row(20201)], { detail: record => ({ items: [{ ...record,
    ExternalDescriptionStr: '<script>document.write("not job content")</script>',
    ExternalResponsibilitiesStr: '<style>.hidden{color:red}</style>', ExternalQualificationsStr: '<!-- placeholder -->' }] }) })
  const jobs = await aci.run(f.options)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('ACI bounds report callbacks by the same source deadline', async () => {
  const f = fixture([row(20201)])
  await assert.rejects(aci.run({ ...f.options, sourceTimeoutMs: 20,
    onReport: () => new Promise(() => {}) }), error => error.code === 'ACI_SOURCE_TIMEOUT')
})

test('ACI preserves external cancellation while reading an ignored body', async () => {
  const controller = new AbortController(), reason = { stop: 'body abort' }
  let started
  const ready = new Promise(resolve => { started = resolve })
  const result = aci.run({ signal: controller.signal, fetchImpl: async () => ({ status: 200,
    headers: new Headers({ 'content-type': 'text/html' }), url: aci.CORPORATE_CAREERS_URL,
    text: () => { started(); return new Promise(() => {}) } }) })
  await ready
  controller.abort(reason)
  await assert.rejects(result, error => error === reason)
})

test('ACI does not follow a public redirect or retry a denied public response', async () => {
  for (const status of [302, 403]) {
    let requests = 0
    await assert.rejects(aci.run({ fetchImpl: async () => {
      requests++
      return new Response('', { status, headers: { location: 'https://other.example/' } })
    } }), error => error.status === status)
    assert.equal(requests, 1)
  }
})
