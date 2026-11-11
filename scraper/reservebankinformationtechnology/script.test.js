import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { MAIN, CONFIG, usernameBytes, clientWith, careers, client, config, expectedBody } from '../../test/helpers/rebitProtocolControl20261111.js'
import * as source from './script.js'

// These complete protocol models are authored controls, not recovered historical
// responses or observations of a current ReBIT API. No login/network is used.
// The genuine retained current page is tested separately at the end of the file.
const openings = Array.from({ length: 14 }, (_, index) => ({
  id: 'control-record-' + (index + 1), job_title: 'Synthetic control role ' + (index + 1),
  job_status: true, location: 'Bengaluru, Karnataka, India', department: 'Synthetic department',
  apply_now_link: 'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/control' + (index + 1),
  job_desc: null, job_experience: null,
}))
const fetchText = async url => url === source.CAREERS_URL ? careers
  : url === MAIN ? client : url === CONFIG ? config : assert.fail('Unexpected controlled source URL ' + url)
const run = (overrides = {}) => source.run({
  now: () => '2026-11-11T00:00:00.000Z', fetchText,
  postJson: async () => ({ status: 'success', access_token: 'synthetic-offline-token' }),
  fetchJson: async () => structuredClone(openings), ...overrides,
})
const assertHeld = jobs => {
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.firstParty, false)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
}

test('synthetic ReBIT protocol binds the anonymous bootstrap and retains fourteen unqualified observations', async () => {
  const calls = []
  const jobs = await run({ postJson: async (url, body) => {
    calls.push(url); assert.deepEqual(body, expectedBody())
    return { status: 'success', access_token: 'synthetic-offline-token' }
  } })
  assert.deepEqual(calls, [source.CAREERS_LOGIN_API_URL])
  assert.equal(jobs.length, 14)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 14)
  assert.ok(jobs.every(job => job.country === 'India' && new URL(job.applyUrl).hostname === 'rebithr.darwinbox.in'))
  assertHeld(jobs)
  assert.ok(jobs.every(job => job.jobDescription === null && job.nativeLegalEmployer === null))
})

test('synthetic ReBIT bootstrap resolves changing bound bytes instead of a cached constant', async () => {
  const changed = usernameBytes.map(value => value + 16)
  const alternate = clientWith(changed)
  assert.notEqual(alternate, client)
  await run({ fetchText: async url => url === MAIN ? alternate : fetchText(url),
    postJson: async (_url, body) => {
      assert.deepEqual(body, expectedBody(changed)); return { access_token: 'synthetic-offline-token' }
    } })
})

test('synthetic ReBIT rejects foreign client URLs and API bases before any anonymous login', async () => {
  let posts = 0
  const postJson = async () => { posts++; return { access_token: 'synthetic-offline-token' } }
  await assert.rejects(run({ postJson, fetchText: async () => careers.replace('src="main-CONTROL20261111.js"', 'src="https://foreign.example/main-CONTROL20261111.js"') }), /client|first-party/i)
  await assert.rejects(run({ postJson, fetchText: async url => url === CONFIG ? config.replace('https://rebit.org.in/web/api', 'https://foreign.example/web/api') : fetchText(url) }), /API|configuration/i)
  assert.equal(posts, 0)
})

test('synthetic ReBIT rejects changed encoding and out-of-range bytes before login', async () => {
  let posts = 0
  const postJson = async () => { posts++; return { access_token: 'synthetic-offline-token' } }
  for (const altered of [client.replace('return btoa(o)', 'return o'), clientWith([999, ...usernameBytes.slice(1)])]) {
    assert.notEqual(altered, client)
    await assert.rejects(run({ postJson, fetchText: async url => url === MAIN ? altered : fetchText(url) }), /bootstrap|payload|encoding/i)
  }
  assert.equal(posts, 0)
})

test('synthetic ReBIT rejects duplicate identities and holds untrusted links or countryless roles', async () => {
  await assert.rejects(run({ fetchJson: async () => [openings[0], openings[0]] }), /duplicate|identity/i)
  const foreign = { ...openings[0], apply_now_link: 'https://foreign.example/apply' }
  const rejected = await run({ fetchJson: async () => [foreign] })
  assert.equal(rejected.length, 0)
  assert.deepEqual(rejected.nativeCollectionEvidence.candidateListingRecords, [foreign])
  assertHeld(rejected)
  const unknown = await run({ fetchJson: async () => [{ ...openings[0], location: 'Remote' }] })
  assert.equal(unknown.length, 1)
  assert.equal(unknown[0].country, null)
  assert.equal(analyzePublishableJobs(unknown).indiaJobs.length, 0)
  assertHeld(unknown)
})

test('synthetic empty ReBIT API response cannot establish a verified empty inventory', async () => {
  const jobs = await run({ fetchJson: async () => [] })
  assert.equal(jobs.length, 0)
  assertHeld(jobs)
})

test('synthetic ReBIT rejects malformed entries and missing boolean active-status semantics', async () => {
  for (const rows of [[null], [{ ...openings[0], job_status: undefined }], [{ ...openings[0], job_status: 'active' }]]) {
    await assert.rejects(run({ fetchJson: async () => rows }), /payload|status|inventory/i)
  }
})

test('synthetic ReBIT listing metadata cannot manufacture full own descriptions', async () => {
  const jobs = await run()
  assert.ok(jobs.every(job => job.jobDescription === null && job.sourceDetailComplete === false))
})

test('synthetic ReBIT preserves nullable fields and retains malformed identities only as raw observations', async () => {
  const jobs = await run({ fetchJson: async () => [{ ...openings[0], job_desc: null, job_experience: null }] })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].experienceRequired, null)
  for (const row of [{ ...openings[0], id: null }, { ...openings[0], job_title: null }]) {
    const held = await run({ fetchJson: async () => [row] })
    assert.equal(held.length, 0)
    assert.deepEqual(held.nativeCollectionEvidence.candidateListingRecords, [row])
    assert.equal(held.nativeCollectionEvidence.failures.length, 1)
    assertHeld(held)
  }
})

test('synthetic ReBIT cannot infer country from inherited keys or trust an alternate application port', async () => {
  const unknown = await run({ fetchJson: async () => [{ ...openings[0], location: 'constructor' }] })
  assert.equal(unknown[0].country, null)
  assert.equal(analyzePublishableJobs(unknown).indiaJobs.length, 0)
  assertHeld(unknown)
  const foreign = { ...openings[0], apply_now_link: openings[0].apply_now_link.replace('rebithr.darwinbox.in', 'rebithr.darwinbox.in:8443') }
  const held = await run({ fetchJson: async () => [foreign] })
  assert.equal(held.length, 0)
  assert.deepEqual(held.nativeCollectionEvidence.candidateListingRecords, [foreign])
  assertHeld(held)
})

test('synthetic ReBIT default transport rejects foreign final identities at every controlled stage', async () => {
  const savedFetch = globalThis.fetch
  try {
    for (const changedUrl of [source.CAREERS_URL, MAIN, CONFIG, source.CAREERS_LOGIN_API_URL, source.CURRENT_OPENINGS_API_URL]) {
      const calls = []
      globalThis.fetch = async (url, options) => {
        calls.push({ url, redirect: options.redirect })
        const json = url === source.CAREERS_LOGIN_API_URL ? { access_token: 'synthetic-offline-token' } : openings
        const body = url.includes('/web/api/') ? JSON.stringify(json) : await fetchText(url)
        const response = new Response(body, { status: 200, headers: { 'content-type': url.includes('/web/api/') ? 'application/json' : 'text/html' } })
        Object.defineProperty(response, 'url', { value: url === changedUrl ? 'https://foreign.example/copied-surface' : url })
        return response
      }
      await assert.rejects(source.run(), /redirect|identity|first-party/i)
      assert.ok(calls.length > 0 && calls.every(call => call.redirect === 'manual'))
      assert.equal(calls.at(-1).url, changedUrl)
    }
  } finally { globalThis.fetch = savedFetch }
})

test('genuine current ReBIT page remains rejected before client, login or API access', async () => {
  const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/fields-20261111.json.gz', import.meta.url))))
  const html = Buffer.from(fixture.packet.bodyBase64, 'base64').toString('utf8')
  let gets = 0, posts = 0, apis = 0
  await assert.rejects(run({ fetchText: async url => { gets++; assert.equal(url, source.CAREERS_URL); return html },
    postJson: async () => { posts++; assert.fail('Unexpected login') },
    fetchJson: async () => { apis++; assert.fail('Unexpected API request') } }), /trusted first-party SPA contract/)
  assert.equal(gets, 1)
  assert.equal(posts, 0)
  assert.equal(apis, 0)
  assert.equal(fixture.nativeAPIPayloads.length, 0)
})
