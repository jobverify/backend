import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers, createCatalogScraper, getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-pagination-provider-responses-20261112.json.gz', import.meta.url))))
const replay = async (t, source, mutate) => {
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const response = fixture.responses.find(row => row.requestedUrl === String(url)
      && row.method === (options.method || 'GET') && row.requestBody === (options.body ?? null))
    assert.ok(response, 'Only recorded native public responses may be read: ' + url)
    const payload = JSON.parse(response.body)
    mutate?.(payload)
    return Response.json(payload)
  })
  return buildScrapers().find(scraper => scraper.name === source).run()
}

for (const [source, total] of [['tenstorrent', 122], ['razorpay', 26], ['databricks', 913], ['mongodb', 381], ['stripe', 787]]) {
  test('direct registered ' + source + ' keeps unclassified native countries incomplete despite matching totals', async t => {
    const jobs = await replay(t, source)
    assert.ok(jobs.length > 0)
    const inventory = readInventoryEvidence(jobs)
    assert.equal(inventory.reportedTotal, total)
    assert.equal(inventory.status, 'discovery-only')
    assert.match(inventory.reason, /native-location-scope-unresolved/)
    assert.doesNotMatch(inventory.reason, /configured-continuation-unavailable|upstream-count-mismatch/)
    assert.equal(inventory.indiaFacetCount, null)
    assert.equal(extractionDetailHealth(jobs).complete, false)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  })
}

test('a genuinely fully scoped captured Greenhouse subset can still complete', async t => {
  // Simulate publisher withdrawal of its three observed unresolved rows; no
  // description, office, country or worksite value is manufactured.
  const ids = new Set([5198062007, 5202618007, 5275381007])
  const jobs = await replay(t, 'tenstorrent', payload => {
    payload.jobs = payload.jobs.filter(row => !ids.has(row.id))
    payload.meta.total = 119
  })
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.reportedTotal, 119)
  assert.equal(inventory.status, 'complete-inventory')
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})

test('direct Greenhouse rejects a role assigned to a different native board', async t => {
  await assert.rejects(replay(t, 'tenstorrent', payload => {
    payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/another-board/jobs/' + payload.jobs[0].id
  }), /foreign native posting account/)
})

test('direct Greenhouse rejects a different role identity on the correct native board', async t => {
  await assert.rejects(replay(t, 'tenstorrent', payload => {
    payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/tenstorrent/jobs/1'
  }), /native posting identity mismatch/)
})


const variantProvider = (overrides = {}, listingApiUrl) => {
  const original = getScraperCatalog().find(provider => provider.source === 'tenstorrent')
  const {config: configOverrides = {}, ...providerOverrides} = overrides
  return { ...original, ...providerOverrides, config: {
    ...original.config, ...configOverrides, discovery: { ...original.config.discovery, ...configOverrides.discovery,
      ...(listingApiUrl ? { listingApiUrl } : {}),
    },
  } }
}
const variantPayload = scoped => {
  const response = fixture.responses.find(row => row.requestedUrl.includes('/boards/tenstorrent/jobs'))
  const payload = JSON.parse(response.body)
  if (scoped) {
    payload.jobs = payload.jobs.filter(row => ![5198062007, 5202618007, 5275381007].includes(row.id))
    payload.meta.total = 119
  }
  return payload
}

for (const [label, overrides] of [
  ['ATS alias', { atsPlatform: 'greenhouse-board-api' }],
  ['Greenhouse template', { atsPlatform: 'official-company-careers', template: 'greenhouse' }],
  ['native API endpoint', { atsPlatform: 'official-company-careers', template: undefined }],
]) test('direct ' + label + ' preserves unresolved native country scope', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(variantPayload(false)))
  const jobs = await createCatalogScraper(variantProvider(overrides)).run()
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.reportedTotal, 122)
  assert.equal(inventory.status, 'discovery-only')
  assert.match(inventory.reason, /native-location-scope-unresolved/)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [label, url] of [
  ['HTTP', 'http://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs'],
  ['credentials', 'https://test-user:test-password@boards-api.greenhouse.io/v1/boards/tenstorrent/jobs'],
  ['nondefault port', 'https://boards-api.greenhouse.io:444/v1/boards/tenstorrent/jobs'],
  ['non-listing path', 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/not-jobs'],
  ['role detail path', 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs/123'],
  ['fragment', 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs#other'],
  ['lookalike host', 'https://boards-api.greenhouse.io.example.test/v1/boards/tenstorrent/jobs'],
]) test('direct Greenhouse rejects ' + label + ' before requesting a listing', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(variantPayload(true)) })
  await assert.rejects(createCatalogScraper(variantProvider({}, url)).run(), /Invalid Greenhouse native board identity/)
  assert.equal(calls, 0)
})

for (const overrides of [{boardToken: 'different-board'}, {templateOptions: {boardToken: 'different-board'}}]) {
  test('direct Greenhouse rejects conflicting declared board identity ' + Object.keys(overrides)[0], async t => {
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(variantPayload(true)) })
    await assert.rejects(createCatalogScraper(variantProvider(overrides)).run(), /Invalid Greenhouse native board identity/)
    assert.equal(calls, 0)
  })
}

test('a valid native Greenhouse endpoint alias retains the scoped positive control', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(variantPayload(true)))
  const jobs = await createCatalogScraper(variantProvider({atsPlatform: 'greenhouse-board-api'},
    'https://api.greenhouse.io/v1/boards/tenstorrent/jobs')).run()
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 119)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})

for (const host of ['boards-api.greenhouse.io', 'api.greenhouse.io']) {
  test('unmarked native Greenhouse host ' + host + ' preserves unresolved country scope', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(variantPayload(false)))
    const jobs = await createCatalogScraper(variantProvider({atsPlatform: 'official-company-careers', template: undefined},
      'https://' + host + '/v1/boards/tenstorrent/jobs')).run()
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  })
  for (const [label, url] of [
    ['HTTP', 'http://' + host + '/v1/boards/tenstorrent/jobs'],
    ['credentials', 'https://test-user:test-password@' + host + '/v1/boards/tenstorrent/jobs'],
    ['nondefault port', 'https://' + host + ':444/v1/boards/tenstorrent/jobs'],
    ['non-listing path', 'https://' + host + '/v1/boards/tenstorrent/not-jobs'],
    ['role detail path', 'https://' + host + '/v1/boards/tenstorrent/jobs/123'],
    ['fragment', 'https://' + host + '/v1/boards/tenstorrent/jobs#other'],
  ]) test('unmarked native Greenhouse host ' + host + ' rejects ' + label + ' before a request', async t => {
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(variantPayload(true)) })
    await assert.rejects(createCatalogScraper(variantProvider({atsPlatform: 'official-company-careers', template: undefined}, url)).run(),
      /Invalid Greenhouse native board identity/)
    assert.equal(calls, 0)
  })
}

for (const [label, overrides, url] of [
  ['unknown listing query', {}, 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs?department_id=1'],
  ['false listing content', {}, 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs?content=false'],
  ['duplicate listing content', {}, 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs?content=true&content=true'],
  ['unknown configured query', {config: {request: {method: 'GET', query: {content: 'true', department_id: 1}}}}],
  ['false configured content', {config: {request: {method: 'GET', query: {content: 'false'}}}}],
  ['configured pagination query', {config: {pagination: {strategy: 'page-number', pageParam: 'office_id', pageSize: 119, resultsPath: 'jobs', totalCountPath: 'meta.total'}}}],
  ['non-GET listing method', {config: {request: {method: 'POST', query: {content: 'true'}}}}],
  ['listing request body', {config: {request: {method: 'GET', query: {content: 'true'}, body: {department_id: 1}}}}],
]) test('direct Greenhouse rejects unreviewed request contract: ' + label, async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(variantPayload(true)) })
  await assert.rejects(createCatalogScraper(variantProvider(overrides, url)).run(), /Invalid Greenhouse native (?:board identity|listing request)/)
  assert.equal(calls, 0)
})

test('direct Greenhouse accepts the sole reviewed content=true query in URL and config', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(variantPayload(true)))
  const jobs = await createCatalogScraper(variantProvider({}, 'https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs?content=true')).run()
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})

test('invalid staged Greenhouse configuration leaves no source deadline timer running', async t => {
  const active=new Set(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout
  t.mock.method(globalThis,'setTimeout',(callback,delay,...args)=>{
    const timer=setTimer(callback,delay,...args)
    if(delay===5000)active.add(timer)
    return timer
  })
  t.mock.method(globalThis,'clearTimeout',timer=>{active.delete(timer);return clearTimer(timer)})
  t.after(()=>{for(const timer of active)clearTimer(timer)})
  const provider=variantProvider({scraperTimeoutMs:5000,config:{pagination:{strategy:'single-page',resultsPath:'jobs',totalCountPath:'meta.total',traversalMode:'staged-snapshot'}}},
    'http://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs')
  await assert.rejects(createCatalogScraper(provider).run(),/Invalid Greenhouse native board identity/)
  assert.equal(active.size,0,'Rejected native configuration must not leave a source timer alive')
})
