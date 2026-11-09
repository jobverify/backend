import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import * as native from './native.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

const actual = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261025.json.gz', import.meta.url))))
const CAREERS = 'https://www.atscale.com/careers/'
const EMBED = 'https://ats.rippling.com/embed/atscale/jobs?s=https%3A%2F%2Fwww.atscale.com%2Fcareers%2F'
const ID = '446309b8-c86a-43a3-8fc2-87be757ac377'
const DETAIL = `https://ats.rippling.com/en-US/atscale/jobs/${ID}`
const CANONICAL = `https://ats.rippling.com/atscale/jobs/${ID}`
const nextPattern = /(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/
const next = html => JSON.parse(nextPattern.exec(html)[2])
const rewrite = (html, change) => html.replace(nextPattern, (_, start, value, end) => {
  const data = JSON.parse(value); change(data); return start + JSON.stringify(data) + end
})
const listData = data => data.props.pageProps.dehydratedState.queries.find(q => q.queryKey[2] === 'job-posts').state.data
const nativeJob = data => data.props.pageProps.apiData.jobPost
const indiaOffice = { name: 'Bengaluru, India', country: 'India', countryCode: 'IN', state: 'Karnataka', stateCode: 'KA', city: 'Bengaluru', workplaceType: 'ON_SITE' }

// Synthetic positive contract only: current real source has zero India roles.
// Mutate native role-assigned fields consistently; retain actual original JD.
const syntheticIndia = () => {
  const sample = structuredClone(actual)
  for (const key of ['firstListing', 'finalListing']) {
    sample.pages[key].html = rewrite(sample.pages[key].html, data => { listData(data).items[0].locations = [indiaOffice] })
      .replace('Boston, MA', 'Bengaluru, India')
  }
  sample.pages.foreignDetail.html = rewrite(sample.pages.foreignDetail.html, data => {
    nativeJob(data).workLocations = ['Bengaluru, India']
    data.props.pageProps.apiData.workLocations = ['Bengaluru, India']
  }).replaceAll('Boston, MA', 'Bengaluru, India')
  return sample
}
const asTransport = receipt => ({ status: receipt.status, url: receipt.url, body: Buffer.from(receipt.html), bodyComplete: true,
  headers: { 'content-type': 'text/html' }, provenance: { captureKind: actual.captureKind,
    receivedAt: receipt.receivedAt, mime: 'fixture HTML declaration; wire content-type header was not retained' } })
const execute = (sample = actual, options = {}) => {
  let listingReads = 0
  return source.run({ now: () => actual.capturedAt, requestIntervalMs: 0, transport: async url => {
    if (url === CAREERS) return asTransport(sample.pages.official)
    if (url === EMBED) return asTransport(sample.pages[++listingReads === 1 ? 'firstListing' : 'finalListing'])
    if (url === DETAIL) return asTransport(sample.pages.foreignDetail)
    throw Error('Unexpected AtScale request: ' + url)
  }, ...options })
}

test('actual AtScale sole official global public board reconciles15 typed foreign roles and dynamic India0', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, 15)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.verifiedAt, actual.capturedAt)
  assert.match(evidence.reason, /current-official-global-public-board/)
})

test('synthetic future India role exercises full actual native JD mapping rather than a hardcoded zero monitor', async () => {
  const jobs = await execute(syntheticIndia())
  assert.equal(jobs.length, 1)
  const original = nativeJob(next(actual.pages.foreignDetail.html)), job = jobs[0]
  assert.equal(job.jobId, ID)
  assert.equal(job.title, 'Product Manager, Data Products')
  assert.equal(job.sourceDescription, original.description.company + '\n' + original.description.role)
  assert.equal(job.jobDescription, job.sourceDescription)
  assert.equal(job.jobDescriptionHtml, job.sourceDescription)
  assert.deepEqual(job.sourceNativeDescriptionSections, original.description)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.sourceNativeEmployer, 'AtScale, Inc.')
  assert.deepEqual(job.sourceNativeLocations, [indiaOffice])
  assert.equal(job.applyUrl, CANONICAL)
  assert.equal(job.sourceUrl, CANONICAL)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourceNativeCreatedOn, '2026-07-30T12:40:24.520000-07:00')
  assert.equal(job.sourceListingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
})

test('actual foreign AtScale native detail validates its original JD and stays explicitly foreign', () => {
  const row = native.parseAtScaleListing(actual.pages.firstListing.html).records.find(row => row.id === ID)
  const fact = native.validateAtScaleDetail(actual.pages.foreignDetail.html, row, { now: actual.capturedAt })
  const original = nativeJob(next(actual.pages.foreignDetail.html))
  assert.equal(fact.job.uuid, ID)
  assert.equal(fact.full, original.description.company + '\n' + original.description.role)
  assert.equal(fact.job.createdOn, '2026-07-30T12:40:24.520000-07:00')
  assert.equal(fact.rawLocations[0].country, 'United States')
  assert.equal(fact.rawLocations[0].countryCode, 'US')
})

test('AtScale rejects wrong/inert current delegation and competing hiring boards', async () => {
  for (const html of [
    '<h1>Careers at AtScale</h1><template><iframe src="' + EMBED + '"></iframe></template>',
    actual.pages.official.html.replaceAll('data-job-board-id="atscale"', 'data-job-board-id="other"'),
    actual.pages.official.html.replaceAll(EMBED, EMBED + '&country=IN'),
    actual.pages.official.html + '<a href="https://jobs.lever.co/other">More open jobs</a>',
  ]) {
    const sample = structuredClone(actual); sample.pages.official.html = html
    await assert.rejects(execute(sample), /AtScale/)
  }
})

test('AtScale requires exact native board/query/pagination/country inventory and stable final recheck', async () => {
  for (const change of [
    x => { x.props.pageProps.apiData.jobBoard.slug = 'other' },
    x => { x.props.pageProps.apiData.jobBoard.companyName = 'Other' },
    x => { x.props.pageProps.apiData.jobBoard.isTest = true },
    x => { x.query.jobBoardSlug = 'other' },
    x => { x.props.pageProps.dehydratedState.queries[0].queryKey[4].country = 'US' },
    x => { listData(x).totalItems = 16 },
    x => { listData(x).totalPages = 2 },
    x => { listData(x).items[0].locations[0].countryCode = 'IN' },
    x => { listData(x).items[0].isClosed = true },
    x => { const p = listData(x).items[0].locations[0]; p.country = 'India'; p.countryCode = 'IN' },
    x => { listData(x).items.push(listData(x).items[0]); listData(x).totalItems++ },
  ]) {
    const sample = structuredClone(actual)
    for (const key of ['firstListing', 'finalListing']) sample.pages[key].html = rewrite(sample.pages[key].html, change)
    await assert.rejects(execute(sample), /AtScale/)
  }
  const drift = structuredClone(actual)
  drift.pages.finalListing.html = rewrite(drift.pages.finalListing.html, x => { listData(x).items[0].name = 'Changed role' })
  await assert.rejects(execute(drift), /AtScale/)
})

test('AtScale coherent unknown/pseudo/aggregate country feeds cannot establish complete India0', async () => {
  for (const [code, country] of [['ZZ', 'Unknown Region'], ['EU', 'European Union'], ['EZ', 'Eurozone'],
    ['UN', 'United Nations'], ['XA', 'Pseudo-Accents'], ['XB', 'Pseudo-Bidi'], ['QO', 'Outlying Oceania'], ['QQ', 'QQ']]) {
    const sample = structuredClone(actual)
    for (const key of ['firstListing', 'finalListing']) sample.pages[key].html = rewrite(sample.pages[key].html, data => {
      for (const row of listData(data).items) for (const place of row.locations) { place.countryCode = code; place.country = country }
    })
    await assert.rejects(execute(sample), /AtScale/, 'Accepted unresolved whole-feed country ' + code)
  }
  for (const country of ['Unknown Region', 'India']) {
    const sample = syntheticIndia()
    for (const key of ['firstListing', 'finalListing']) sample.pages[key].html = rewrite(sample.pages[key].html, data => {
      const place = listData(data).items[0].locations[0]; place.countryCode = 'ZZ'; place.country = country
    })
    await assert.rejects(execute(sample), /AtScale/, 'India office must not rescue unresolved country evidence')
  }
})

test('AtScale explicitly inactive or unpublished native India listings cannot qualify a cached open detail', async () => {
  for (const key of ['isActive', 'active', 'published', 'isPublished']) {
    const sample = syntheticIndia()
    for (const page of ['firstListing', 'finalListing']) sample.pages[page].html = rewrite(sample.pages[page].html, data => { listData(data).items[0][key] = false })
    await assert.rejects(execute(sample), /AtScale/, 'Accepted native listing ' + key + ':false')
  }
})

test('AtScale runtime query cannot hide country scope behind an unfiltered cached query key', async () => {
  for (const [key, value] of [['country', 'US'], ['departments', ['Engineering']], ['preview', true]]) {
    const sample = structuredClone(actual)
    for (const page of ['firstListing', 'finalListing']) sample.pages[page].html = rewrite(sample.pages[page].html, data => { data.query[key] = value })
    await assert.rejects(execute(sample), /AtScale/, 'Accepted native runtime query restriction ' + key)
  }
})

test('AtScale semantic native error fields override cached job rows before complete India0', async () => {
  for (const [key, value] of [['errorCode', 403], ['errormessage', 'permission denied'], ['error_message', 'upstream unavailable']]) {
    const sample = structuredClone(actual)
    for (const page of ['firstListing', 'finalListing']) sample.pages[page].html = rewrite(sample.pages[page].html, data => { data.props.pageProps.apiData[key] = value })
    await assert.rejects(execute(sample), /AtScale/, 'Accepted native cached inventory with ' + key)
  }
})

test('AtScale explicit detail caps preserve incomplete coverage and start no omitted role request', async () => {
  const sample = syntheticIndia(), requests = []
  for (const key of ['firstListing', 'finalListing']) sample.pages[key].html = rewrite(sample.pages[key].html, x => { listData(x).items[1].locations = [indiaOffice] })
  const jobs = await execute(sample, { maxJobs: 1, transport: async url => {
    requests.push(url)
    return asTransport(url === CAREERS ? sample.pages.official : url === DETAIL ? sample.pages.foreignDetail : sample.pages.firstListing)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.deepEqual(requests, [CAREERS, EMBED, DETAIL, EMBED, CAREERS])
})

test('AtScale caller cancellation settles an active cooperative native request and preserves the original reason', async () => {
  const controller = new AbortController(), reason = Error('stop active AtScale request')
  let active = 0, started
  const ready = new Promise(resolve => { started = resolve })
  const running = execute(actual, { signal: controller.signal, transport: async (url, { signal }) => {
    active++; started()
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => setTimeout(() => {
      active--; reject(signal.reason)
    }, 20), { once: true }))
  } })
  await ready; controller.abort(reason)
  await assert.rejects(running, error => error === reason)
  assert.equal(active, 0)
})

test('AtScale full native detail guards role, employer, country, open/apply state, dates and substantive original JD', async () => {
  for (const change of [
    x => { nativeJob(x).uuid = 'a'.repeat(36) }, x => { nativeJob(x).name = 'Other title' },
    x => { nativeJob(x).companyName = 'Other Employer' }, x => { nativeJob(x).board.slug = 'other' },
    x => { nativeJob(x).unlistedFromSearch = true }, x => { nativeJob(x).country = 'United States' },
    x => { nativeJob(x).workLocations = ['London, United Kingdom'] },
    x => { nativeJob(x).description.role = '<template>Develop systems for customers.</template>' },
    x => { nativeJob(x).createdOn = '2026-02-31T12:00:00Z' },
    x => { nativeJob(x).createdOn = '2099-01-01T12:00:00Z' },
    x => { nativeJob(x).publishedOn = '2026-10-25T00:00:00Z' },
    x => { nativeJob(x).closingDate = 'invalid' },
    x => { nativeJob(x).activeJobApplication.basicQuestions = [] },
  ]) {
    const sample = syntheticIndia(); sample.pages.foreignDetail.html = rewrite(sample.pages.foreignDetail.html, change)
    const jobs = await execute(sample)
    assert.equal(jobs.length, 0, 'Accepted mutated native detail: ' + String(change))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  }
  const disabled = syntheticIndia(); disabled.pages.foreignDetail.html = disabled.pages.foreignDetail.html.replaceAll('data-disabled="false"', 'data-disabled="true"')
  assert.equal((await execute(disabled)).length, 0)
})

test('AtScale never fabricates receipts or retries permissions and cannot claim complete failed detail coverage', async () => {
  await assert.rejects(execute(actual, { transport: async () => actual.pages.official.html }), /AtScale/)
  await assert.rejects(execute(actual, { fetchText: async () => actual.pages.official.html }), /AtScale/)
  let attempts = 0
  const jobs = await execute(syntheticIndia(), { transport: async url => {
    if (url === DETAIL) { attempts++; return { ...asTransport(actual.pages.foreignDetail), status: 403 } }
    return asTransport(url === CAREERS ? actual.pages.official : syntheticIndia().pages.firstListing)
  } })
  assert.equal(attempts, 1)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(execute(actual, { transport: async () => ({ ...asTransport(actual.pages.official), url: 'https://other.example/' }) }), /AtScale/)
})

test('AtScale cancellation and source deadline have a bounded lifecycle', async () => {
  const controller = new AbortController(), reason = Error('stop AtScale')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(execute(actual, { signal: controller.signal, transport: async () => { calls++; return {} } }), error => error === reason)
  assert.equal(calls, 0)
  let timer
  const outcome = await Promise.race([
    execute(actual, { sourceBudgetMs: 10, transport: async () => new Promise(() => {}) }).then(() => ({ success: true }), error => ({ error })),
    new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), 500) }),
  ])
  clearTimeout(timer)
  assert.equal(outcome.timedOut, undefined)
  assert.match(outcome.error?.message || '', /AtScale.*deadline/)
})

test('AtScale complete evidence requires the closing official receipt to retain native HTML MIME', async () => {
  let officialReads = 0
  await assert.rejects(execute(actual, { transport: async url => {
    const response = asTransport(url === CAREERS ? actual.pages.official : actual.pages.firstListing)
    if (url === CAREERS && ++officialReads === 2) response.headers['content-type'] = 'text/plain'
    return response
  } }), /AtScale/)
})

test('AtScale registry remains executable with static inventory counters null', () => {
  const p = getScraperCatalog().find(p => p.source === 'atscale')
  assert.equal(p.companyCareerPage, CAREERS)
  assert.equal(p.verifiedPublicJobCount, null)
  assert.equal(p.verifiedIndiaJobCount, null)
  assert.equal(p.inventoryScope, 'current-official-global-public-board')
})
