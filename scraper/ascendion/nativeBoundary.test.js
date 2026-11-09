import assert from 'node:assert/strict'
import test from 'node:test'
import { readCaptureManifest, readCaptureBody } from './native-captures/readFixture.js'
import { createHash } from 'node:crypto'
import { buildSearchUrl, buildDetailUrl, createAscendionScraper, extractSearchResults, run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const capture = label => readCaptureBody('2026-11-05', `${label}.body.gz`).toString()
const search = JSON.parse(capture('search'))
const originalDetail = JSON.parse(capture('detail'))
const first = search.data.positions[0]
// Every modification below is a modeled fault control, never represented as a genuine native capture.
const modelPosition = (id, fields = {}) => ({ ...structuredClone(first), id: String(id), displayJobId: String(id), atsJobId: String(id), positionUrl: `/careers/job/${id}`, ...fields })
const modelDetail = (id, fields = {}) => ({ ...structuredClone(originalDetail), data: { ...structuredClone(originalDetail.data), id: String(id), displayJobId: String(id), atsJobId: String(id), positionUrl: `/careers/job/${id}`, publicUrl: `https://jobs.ascendion.com/careers/job/${id}`, ...fields } })
const page = (positions, count) => ({ ...structuredClone(search), data: { ...structuredClone(search.data), positions, count } })
const officialText = async url => {
  if (url === 'https://ascendion.com/who-we-are/careers/') return capture('corporate')
  if (url === 'https://jobs.ascendion.com/careers') return capture('careers')
  if (url === 'https://jobs.ascendion.com/gen/js/pcsxPwa.5191c5f321507e70.js') return capture('protocol')
  throw Error(`Unexpected official document ${url}`)
}
const replay = (rows, overrides = {}) => async url => {
  const u = new URL(url)
  if (u.pathname === '/api/pcsx/search') {
    const start = Number(u.searchParams.get('start'))
    return page(rows.slice(start, start + 2), rows.length)
  }
  if (u.pathname === '/api/pcsx/position_details') {
    const id = u.searchParams.get('position_id')
    return overrides[id] ? overrides[id]() : modelDetail(id)
  }
  throw Error(`Unexpected modeled document ${url}`)
}
const options = (rows, extra = {}) => ({ fetchText: officialText, fetchJson: replay(rows), ...extra })

test('genuine portable native captures retain original body hashes and full authored criteria', () => {
  const manifest = readCaptureManifest('2026-11-05')
  for (const r of manifest.records) {
    const body = readCaptureBody('2026-11-05', r.bodyFile)
    assert.equal(createHash('sha256').update(body).digest('hex'), r.bodySHA256)
    assert.equal(body.length, r.bytes)
  }
  assert.match(originalDetail.data.jobDescription, /Knowledge of ITIL processes and SLA management/)
  assert.deepEqual(originalDetail.data.standardizedLocations, ['Bengaluru, KA, IN'])
})

test('foreign and unresolved native workplaces never acquire an India label', () => {
  const rows = [modelPosition('1'), modelPosition('2', { locations: ['Seattle, Washington, United States'], standardizedLocations: ['Seattle, WA, US'] }), modelPosition('3', { locations: ['Bangalore'], standardizedLocations: [] })]
  const jobs = extractSearchResults(page(rows, 3))
  assert.deepEqual(jobs.map(j => j.jobId), ['1'])
  assert.equal(jobs[0].country, 'India')
})

test('public collector advances by the returned native page boundary and closes the same unique ID set', async () => {
  const calls = []
  const rows = ['1', '2', '3'].map(id => modelPosition(id))
  const fetchJson = replay(rows)
  const jobs = await createAscendionScraper({ pageSize: 10 }).run(options(rows, { fetchJson: async url => { calls.push(url); return fetchJson(url) } }))
  assert.deepEqual(jobs.map(j => j.jobId), ['1', '2', '3'])
  assert.equal(calls.filter(url => url === buildSearchUrl({ start: 0 })).length, 2)
  assert.ok(calls.includes(buildSearchUrl({ start: 2 })))
  assert.ok(calls.includes(buildSearchUrl({ start: 3 })))
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].staleCleanupSafe, true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('unresolved secondary workplace remains an observation and prevents cleanup', async () => {
  const rows = [modelPosition('1'), modelPosition('2', { locations: ['Remote'], standardizedLocations: [] })]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '2': () => modelDetail('2', { locations: ['Remote'], standardizedLocations: [], location: 'Remote' }) }) }))
  assert.deepEqual(jobs.map(j => j.jobId), ['1'])
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].staleCleanupSafe, false)
  assert.equal(jobs[0].nativeCollectionEvidence.unknownCountryObservations[0].id, '2')
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('native detail failure remains visible through real detail health on the returned roles', async () => {
  const rows = ['1', '2'].map(id => modelPosition(id))
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '2': () => { throw Error('modeled network failure') } }) }))
  assert.deepEqual(jobs.map(j => j.jobId), ['1'])
  const health = extractionDetailHealth(jobs)
  assert.equal(health.complete, false)
  assert.equal(health.nativeCollections[0].unextractedDetailFailures, 1)
  assert.equal(health.nativeCollections[0].countsReconciled, true)
  assert.equal(jobs[0].staleCleanupSafe, false)
})

test('mismatched native detail identity stops queued detail work at bounded concurrency', async () => {
  const rows = ['1', '2', '3', '4', '5'].map(id => modelPosition(id))
  const calls = []
  const fetchJson = replay(rows, { '1': () => modelDetail('foreign-id') })
  await assert.rejects(createAscendionScraper({ detailConcurrency: 2 }).run(options(rows, { fetchJson: async url => { if (url.includes('position_details')) calls.push(url); return fetchJson(url) } })), /identity/i)
  assert.ok(calls.length <= 2)
})

test('unknown-only native observations survive empty projection without verified zero', async () => {
  const rows = [modelPosition('1', { locations: ['Bangalore'], standardizedLocations: [] })]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { locations: ['Bangalore'], standardizedLocations: [], location: 'Bangalore' }) }) }))
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'ascendion').observedVacancyCount, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('exported run preserves a falsey caller cancellation reason before invoking readers', async () => {
  const controller = new AbortController()
  controller.abort(false)
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => { requests++; const error = Error('unexpected default reader'); error.abortRetries = true; throw error }
  try {
    let reason = Symbol('not-cancelled')
    try { await run(options([], { signal: controller.signal })) } catch (error) { reason = error }
    assert.equal(reason, false)
    assert.equal(requests, 0)
  } finally { globalThis.fetch = originalFetch }
})

test('caller cancellation races an ignored pending reader and preserves opaque identity', async () => {
  const controller = new AbortController()
  const reason = Object.create(null)
  Object.defineProperty(reason, 'toString', { get() { throw Error('must not inspect caller reason') } })
  const task = createAscendionScraper().run({ signal: controller.signal, fetchText: () => new Promise(() => {}), fetchJson: () => new Promise(() => {}) })
  setTimeout(() => controller.abort(reason), 5)
  let actual
  try { await Promise.race([task, new Promise((_, reject) => setTimeout(() => reject(Error('cancellation did not settle')), 250))]) } catch (error) { actual = error }
  assert.equal(actual, reason)
})

test('a title-only native description cannot become complete content through its highlights', async () => {
  const rows = [modelPosition('1')]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { jobDescription: '<div>AWS Data Engineer</div><div>AWS Data Engineer</div>', jdHighlight: ['Excellent experience and qualifications for complex systems'] }) }) }))
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-authored-criteria')
  assert.equal(jobs[0].staleCleanupSafe, false)
  assert.equal(extractionDetailHealth(jobs).complete, false)
})

test('missing native employer identity and a changed official handoff fail closed', async () => {
  const rows = [modelPosition('1')]
  await assert.rejects(createAscendionScraper().run(options(rows, { fetchText: async url => url === 'https://ascendion.com/who-we-are/careers/' ? '<html>Other company</html>' : officialText(url) })), /handoff|identity/i)
  await assert.rejects(createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { publicUrl: 'https://other.example/careers/job/1' }) }) })), /identity/i)
})

test('bounded request budgets and ignored readers return promptly without authorizing cleanup', async () => {
  const rows = [modelPosition('1')]
  const jobs = await createAscendionScraper({ maxRequests: 4 }).run(options(rows))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const began = Date.now()
  await assert.rejects(createAscendionScraper({ requestTimeoutMs: 15 }).run({ fetchText: () => new Promise(() => {}) }), /timeout|deadline/i)
  assert.ok(Date.now() - began < 250)
})

test('a duplicate native page cannot count as unique inventory or a successful closing pass', async () => {
  const rows = ['1', '2'].map(id => modelPosition(id))
  const reader = replay(rows)
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: async url => {
    const u = new URL(url)
    if (u.pathname === '/api/pcsx/search' && u.searchParams.get('start') === '0') return page([rows[0], rows[0]], 2)
    return reader(url)
  } }))
  assert.deepEqual(jobs.map(j => j.jobId), ['1'])
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false)
  assert.equal(jobs[0].staleCleanupSafe, false)
})

test('the genuine full capture remains partial through the registered provider with 258 raw versus 255 India roles', async () => {
  const { buildScrapers } = await import('../../scraper-support/providers/index.js')
  const { extractionRawJobMetrics } = await import('../../scraper-support/utils/extractionRawJobMetrics.js')
  const manifest = readCaptureManifest('2026-11-05-full')
  const queues = new Map(), nativeDetails = new Map()
  for (const r of manifest.records) {
    const body = readCaptureBody('2026-11-05-full', r.bodyFile)
    assert.equal(createHash('sha256').update(body).digest('hex'), r.bodySHA256)
    assert.equal(body.length, r.bytes)
    if (!queues.has(r.url)) queues.set(r.url, [])
    queues.get(r.url).push({ ...r, body })
    if (r.stage === 'native-detail') { const detail = JSON.parse(body).data; nativeDetails.set(String(detail.id), detail) }
  }
  const scraper = buildScrapers().find(s => s.name === 'ascendion')
  const jobs = await scraper.run({ fetchText: async url => {
    const r = queues.get(url)?.shift()
    assert.ok(r, `Missing unchanged capture for ${url}`)
    return { body: r.body, url: r.finalUrl, status: r.status }
  } })
  assert.equal(jobs.length, 255)
  assert.deepEqual(extractionRawJobMetrics(scraper.provider, jobs, readInventoryEvidence(jobs)), { rawJobs: 258, rawJobsBasis: 'observed-native-vacancy-rows' })
  const evidence = jobs[0].nativeCollectionEvidence
  assert.equal(evidence.listingPaginationComplete, true)
  assert.equal(evidence.closingInventoryMatches, true)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.unknownCountryObservations.length, 9)
  assert.deepEqual(evidence.exclusions.map(e => e.id).sort(), ['1970324837485782', '1970324837513585', '1970324837573767'])
  assert.equal(jobs.find(j => j.jobId === '1970324837570934').sourceWorkplaces[2].countryCode, 'US')
  assert.deepEqual(jobs.filter(j => !j.sourceDetailComplete).map(j => j.jobId).sort(), ['1970324837565121', '1970324837573706'])
  for (const job of jobs) {
    const native = nativeDetails.get(job.jobId)
    assert.equal(job.title, native.name.replace(/\s+/g, ' ').trim())
    assert.equal(job.sourceDescriptionHtml, native.jobDescription)
    assert.equal(job.sourceDescriptionEvidence.htmlSHA256, createHash('sha256').update(native.jobDescription).digest('hex'))
    assert.ok(job.sourceWorkplaces.some(w => w.countryCode === 'IN'))
    assert.equal(job.staleCleanupSafe, false)
  }
  const health = extractionDetailHealth(jobs)
  assert.equal(health.complete, false)
  assert.equal(health.nativeCollections.length, 1)
  assert.equal(health.nativeCollections[0].candidateDetails, 258)
  assert.equal(health.nativeCollections[0].parsedDetails, 255)
  assert.equal(health.nativeCollections[0].excludedDetails, 3)
  assert.equal(health.nativeCollections[0].countsReconciled, true)
  assert.equal([...queues.values()].reduce((n, rows) => n + rows.length, 0), 0)
})

test('registered empty unknown-country projection preserves raw observations instead of verified zero', async () => {
  const { buildScrapers } = await import('../../scraper-support/providers/index.js')
  const { extractionRawJobMetrics } = await import('../../scraper-support/utils/extractionRawJobMetrics.js')
  const scraper = buildScrapers().find(s => s.name === 'ascendion')
  const rows = [modelPosition('1', { locations: ['Remote'], standardizedLocations: ['Remote'] })]
  const jobs = await scraper.run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { locations: ['Remote'], standardizedLocations: ['Remote'], location: 'Remote' }) }) }))
  assert.equal(jobs.length, 0)
  assert.deepEqual(extractionRawJobMetrics(scraper.provider, jobs, readInventoryEvidence(jobs)), { rawJobs: 1, rawJobsBasis: 'observed-native-vacancy-rows' })
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('a country relation changed between listing and detail never authorizes cleanup', async () => {
  const rows = [modelPosition('1')]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { locations: ['Bangalore, Karnataka, India', 'Remote'], standardizedLocations: ['Bengaluru, KA, IN', 'Remote'] }) }) }))
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.ok(jobs[0].nativeCollectionEvidence.failures.some(f => f.kind === 'listing-detail-workplace-mismatch'))
})

test('a native detail explicitly naming a different employer stops the source', async () => {
  const rows = [modelPosition('1')]
  await assert.rejects(createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { company: 'Other Company' }) }) })), /identity/i)
})

test('falsey caller reasons survive readers that reject after the abort', async () => {
  for (const reason of [false, 0, '', null]) {
    const controller = new AbortController()
    let calls = 0, actual = Symbol('no rejection')
    try {
      await run({ signal: controller.signal, fetchText: async () => { calls++; controller.abort(reason); throw Error('reader rejection after caller abort') } })
    } catch (error) { actual = error }
    assert.equal(actual, reason)
    assert.equal(calls, 1)
  }
})

test('default native body readers preserve opaque cancellation even when their read promise ignores it', async () => {
  const controller = new AbortController(), reason = Object.create(null)
  Object.defineProperty(reason, 'message', { get() { throw Error('caller reason is opaque') } })
  let cancelledReader = 0
  const task = run({ signal: controller.signal, fetchImpl: async url => ({ status: 200, url, body: { getReader: () => ({
    read: () => new Promise(() => {}), cancel: () => { cancelledReader++; return Promise.reject(Error('ignored cancel rejection')) }, releaseLock: () => {},
  }) } }) })
  setTimeout(() => controller.abort(reason), 5)
  let actual
  try { await task } catch (error) { actual = error }
  assert.equal(actual, reason)
  assert.equal(cancelledReader, 1)
})

test('stream byte limits stop body reads without reading another native document', async () => {
  let reads = 0, requests = 0, cancelledReader = 0
  await assert.rejects(run({ maxResponseBytes: 16, fetchImpl: async url => {
    requests++
    return { status: 200, url, body: { getReader: () => ({
      read: async () => { reads++; return { done: false, value: Buffer.alloc(32) } },
      cancel: () => { cancelledReader++; return Promise.resolve() }, releaseLock: () => {},
    }) } }
  } }), /byte budget/)
  assert.equal(reads, 1)
  assert.equal(requests, 1)
  assert.equal(cancelledReader, 1)
})

test('Ascendion company boilerplate alone cannot establish complete authored role criteria', async () => {
  const rows = [modelPosition('1')]
  // Modeled truncation fault: exact genuine company intro, with the authored role section removed.
  const introOnly = originalDetail.data.jobDescription.split('<div>About the Role</div>')[0]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { jobDescription: introOnly }) }) }))
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-authored-criteria')
  assert.equal(jobs[0].staleCleanupSafe, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('a native monitoring title alone cannot masquerade as authored role criteria', async () => {
  const rows = [modelPosition('1')]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { jobDescription: '<div>NOC Monitoring</div><div>NOC Monitoring</div>' }) }) }))
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].staleCleanupSafe, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('inert template or hidden criteria never establish a complete native description', async () => {
  for (const html of ['<template><p>Minimum qualifications: degree and ten years of software development experience.</p></template>', '<div hidden>Minimum qualifications: degree and ten years of software development experience.</div>', '<!-- Minimum qualifications: degree and ten years of software development experience. -->']) {
    const rows = [modelPosition('1')]
    const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { jobDescription: html }) }) }))
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].staleCleanupSafe, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  }
})

test('an India careers link in comments or inert markup cannot establish corporate ownership', async () => {
  const rows = [modelPosition('1')]
  const card = '<div class="promo-grid__card"><p class="promo-grid__card-label">India</p><a href="https://jobs.ascendion.com/careers">Apply</a></div>'
  for (const html of [`<!--${card}-->`, `<template>${card}</template>`, `<div hidden>${card}</div>`]) {
    await assert.rejects(createAscendionScraper().run(options(rows, { fetchText: url => url === 'https://ascendion.com/who-we-are/careers/' ? html : officialText(url) })), /handoff|identity/i)
  }
})

test('invalid native country codes remain unresolved even beside an explicit India relation', async () => {
  const locations = ['Bangalore, Karnataka, India', 'Remote']
  const standardizedLocations = ['Bengaluru, KA, IN', 'Remote, ZZ']
  const rows = [modelPosition('1', { locations, standardizedLocations })]
  const jobs = await createAscendionScraper().run(options(rows, { fetchJson: replay(rows, { '1': () => modelDetail('1', { locations, standardizedLocations }) }) }))
  assert.deepEqual(jobs[0].sourceWorkplaces.map(w => w.countryCode), ['IN', null])
  assert.equal(jobs[0].nativeCollectionEvidence.unknownCountryObservations.length, 1)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].staleCleanupSafe, false)
})
