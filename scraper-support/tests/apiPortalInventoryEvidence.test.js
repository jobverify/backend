import assert from 'node:assert/strict'
import test from 'node:test'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper } from '../providers/index.js'

const record = (id, location = 'Bengaluru, India') => ({ id, title: 'Software Engineer', location,
  applyUrl: `https://careers.acme.test/jobs/${id}`, description: 'Build reliable production software.' })
const provider = pagination => ({ source: 'acme', companyName: 'Acme', companyCareerPage: 'https://careers.acme.test/jobs',
  config: { discovery: { listingApiUrl: 'https://careers.acme.test/api/jobs' },
    pagination: { strategy: 'page-number', pageSize: 2, resultsPath: 'jobs', totalCountPath: 'total', ...pagination },
    mapping: { title: 'title', location: 'location', jobId: 'id', applyUrl: 'applyUrl', jobDescription: 'description' },
    resultFilter: { include: [{ field: 'location', pattern: 'India' }] },
  } })

test('API portal cancellation prevents the first request', async () => {
 const reason = Error('stop this run')
 await assert.rejects(runApiPortalScraper({ provider: provider(), signal: AbortSignal.abort(reason),
  fetchJson: async () => assert.fail('unexpected request') }), error => error === reason)
})

test('cancellation during optional detail cannot become a successful listing fallback', async () => {
 const controller = new AbortController(), reason = Error('stop detail work'), configured = provider()
 configured.config.detail = { enabled: true, required: false, urlTemplate: 'https://careers.acme.test/detail/{{jobId}}', mapping: { jobDescription: 'description' } }
 await assert.rejects(runApiPortalScraper({ provider: configured, signal: controller.signal, fetchJson: async url => {
  if (!url.includes('/detail/')) return { jobs: [record('1')], total: 1 }
  controller.abort(reason)
  return { description: 'Build reliable production software.' }
 } }), error => error === reason)
})

test('registered API portal passes cancellation through to native fetch', async t => {
 const controller = new AbortController(), reason = Error('stop native request')
 t.mock.method(globalThis, 'fetch', async (url, options) => {
  assert.ok(options.signal instanceof AbortSignal)
  controller.abort(reason)
  return Response.json({ jobs: [], total: 0 })
 })
 await assert.rejects(createCatalogScraper({ ...provider(), adapter: 'apiPortal' }).run({ signal: controller.signal }), error => error === reason)
})

test('missing or non-array listing contracts fail instead of certifying an empty successful extraction', async () => {
  for (const payload of [{}, { error: 'unauthorized' }, { jobs: {} }, { jobs: [null] }]) {
    await assert.rejects(runApiPortalScraper({ provider: provider(), fetchJson: async () => payload }), /listing|inventory/i)
  }
})

test('complete pagination records current upstream counts separately from filtered India jobs', async () => {
  const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: async url => new URL(url).searchParams.get('page') === '1'
    ? { jobs: [record('1'), record('2', 'New York, United States')], total: 3 }
    : { jobs: [record('3')], total: 3 } })
  assert.equal(jobs.length, 2)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.reportedTotal, 3)
  assert.equal(evidence?.pagesFetched, 2)
  assert.equal(evidence?.indiaFacetCount, 2)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), true)
})

test('an explicit empty array and zero upstream total produce fresh verified-empty evidence', async () => {
  const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: async () => ({ jobs: [], total: 0 }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('repeated pages stop before a third request can loop indefinitely', async () => {
  let calls = 0
  await assert.rejects(runApiPortalScraper({ provider: provider({ totalCountPath: null, hasMorePath: 'more' }), fetchJson: async () => {
    if (++calls > 2) throw new Error('repeated page was not detected before third request')
    return { jobs: [record('1')], more: true }
  } }), /inventory.*repeated page/i)
  assert.equal(calls, 2)
})

test('early empty pages contradicting upstream totals cannot establish completeness', async () => {
  await assert.rejects(runApiPortalScraper({ provider: provider(), fetchJson: async () => ({ jobs: [], total: 4 }) }), /inventory.*(?:incomplete|count)/i)
})

test('a single-page adapter with explicit continuation preserves jobs without authorizing lifecycle deletion', async () => {
  const jobs = await runApiPortalScraper({ provider: provider({ strategy: 'single-page', hasMorePath: 'more' }),
    fetchJson: async () => ({ jobs: [record('1')], more: true, total: 3 }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
})

test('unmappable inventory cannot become a verified zero', async () => {
  const jobs = await runApiPortalScraper({ provider: provider({ strategy: 'single-page' }),
    fetchJson: async () => ({ jobs: [{ id: 'broken', location: 'India' }], total: 1 }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
})

test('an Eightfold HTTP 403 propagates without manufacturing a current-openings job', async () => {
  const error = Object.assign(new Error('HTTP 403 for https://acme.eightfold.ai/api/pcsx/search'), { status: 403 })
  await assert.rejects(runApiPortalScraper({ provider: { ...provider(), atsPlatform: 'eightfold' }, fetchJson: async () => { throw error } }), error)
})

test('configured page limits abort incomplete inventories before issuing extra requests', async () => {
  let calls = 0
  await assert.rejects(runApiPortalScraper({ provider: provider({ pageSize: 1, maxPages: 2, totalCountPath: null, hasMorePath: 'more' }), fetchJson: async () => {
    if (++calls > 2) throw new Error('configured page limit was ignored')
    return { jobs: [record(String(calls))], more: true }
  } }), /inventory.*page limit/i)
  assert.equal(calls, 2)
})

test('optional detail failures retain usable listing jobs while preventing lifecycle deletion', async () => {
  const config = provider({ strategy: 'single-page' })
  config.config.detail = { enabled: true, required: false, urlTemplate: 'https://careers.acme.test/api/jobs/{{jobId}}' }
  const jobs = await runApiPortalScraper({ provider: config, fetchJson: async url => {
    if (url.includes('/api/jobs/1')) throw new Error('detail endpoint unavailable')
    return { jobs: [record('1')], total: 1 }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
})

test('an explicit upstream error cannot certify zero inventory even with an empty listing array', async () => {
  for (const state of [{ success: false }, { error: 'unauthorized' }, { errors: ['blocked'] }]) {
    await assert.rejects(runApiPortalScraper({ provider: provider(), fetchJson: async () => ({ jobs: [], total: 0, ...state }) }), /inventory.*upstream/i)
  }
})

test('numeric and string end markers stop pagination instead of requesting the same final page again', async () => {
  for (const end of [0, '0', 'false', false, null]) {
    let calls = 0
    const jobs = await runApiPortalScraper({ provider: provider({ strategy: 'offset-limit', pageSize: 1, totalCountPath: null, hasMorePath: 'nextPageId', nullHasMoreIsTerminal: true }),
      fetchJson: async () => {
        if (++calls > 1) throw new Error('unexpected continuation after terminal nextPageId')
        return { jobs: [record('1')], nextPageId: end }
      } })
    assert.equal(calls, 1)
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  }
})

test('missing or null configured totals remain unknown even when the observed listing is empty', async () => {
  for (const payload of [{ jobs: [] }, { jobs: [], total: null }]) {
    const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: async () => payload })
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  }
})

test('missing or null configured continuation flags cannot authorize lifecycle deletion', async () => {
  for (const flags of [{}, { more: null }]) {
    const jobs = await runApiPortalScraper({ provider: provider({ totalCountPath: null, hasMorePath: 'more' }),
      fetchJson: async () => ({ jobs: [record('1')], ...flags }) })
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  }
})

test('overlapping vacancy identities on different pages cannot inflate completeness counts', async () => {
  const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: async url => new URL(url).searchParams.get('page') === '1'
    ? { jobs: [record('1'), record('2')], total: 4 }
    : { jobs: [record('2'), record('3')], total: 4 } })
  assert.equal(jobs.length, 4)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

test('required detail HTTP-success error payloads and missing content fail the role contract', async () => {
  for (const detail of [{ error: 'blocked', success: false }, {}, { body: { description: '<p> </p>' } }]) {
    const config = provider({ strategy: 'single-page' })
    config.config.detail = { enabled: true, required: true, urlTemplate: 'https://careers.acme.test/api/jobs/{{jobId}}',
      mapping: { jobDescription: 'body.description' } }
    await assert.rejects(runApiPortalScraper({ provider: config, fetchJson: async url => url.includes('/api/jobs/1')
      ? detail : { jobs: [record('1')], total: 1 } }), /detail.*(?:upstream|description|contract)/i)
  }
})

test('missing employer descriptions cannot produce complete extraction evidence', async () => {
  const jobs = await runApiPortalScraper({ provider: provider({ strategy: 'single-page' }),
    fetchJson: async () => ({ jobs: [{ ...record('1'), description: null }], total: 1 }) })
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
