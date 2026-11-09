import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'
import { hasOfficialCareersPageSignal, extractWorkdayBoardUrl } from '../../scraper/jadeglobal.workday/script.js'

const directory = new URL('./test-data/ats-soft-20261107/', import.meta.url)
const capture = source => JSON.parse(gunzipSync(fs.readFileSync(new URL(source + '.json.gz', directory))))
const body = receipt => {
  const bytes = Buffer.from(receipt.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
  assert.equal(bytes.length, receipt.bytes)
  return bytes
}
const provider = source => structuredClone(getScraperCatalog().find(row => row.source === source))
const replay = (t, source, transform = () => {}) => {
  const retained = capture(source)
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const requested = new URL(String(url))
    // The initial generic Twilio contract omitted limit; the response defaults
    // to the same demonstrated 10-row page. All other query values must match.
    if (source === 'twilio' && requested.pathname.endsWith('/search') && !requested.searchParams.has('limit')) requested.searchParams.set('limit', '10')
    const receipt = retained.requests.find(row => row.requestedUrl === requested.href && row.method === (init.method || 'GET')
      && (row.requestBody ?? null) === (init.body ?? null))
    assert.ok(receipt, 'Uncaptured public request: ' + requested.href)
    let bytes = body(receipt)
    if (/\/api\/pcsx\//.test(requested.pathname) || requested.pathname.includes('/wday/cxs/')) {
      const payload = JSON.parse(bytes)
      transform(payload, requested)
      bytes = Buffer.from(JSON.stringify(payload))
    }
    const response = new Response(bytes, { status: receipt.status, headers: { 'content-type': receipt.contentType || receipt.headers?.['content-type'] || 'text/html' } })
    Object.defineProperty(response, 'url', { value: receipt.finalUrl })
    return response
  })
  return retained
}

test('the registered eInfochips source accepts the current role-owned Bangalore Karnataka workplace and retains all native content', async t => {
  const retained = replay(t, 'einfochips')
  const jobs = await createCatalogScraper(provider('einfochips')).run({
    now: retained.checkedAt,
    runWorkday: options => runWorkdayScraper({ ...options, nativeDetailRecovery: false, retryBaseDelayMs: 0,
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} } }),
  })
  assert.equal(jobs.length, 28)
  const role = jobs.find(job => job.requisitionId === 'R249865')
  assert.equal(role.title, 'Senior Engineer - Automation')
  assert.deepEqual(role.nativeLocations, ['Bangalore, Karnataka'])
  assert.equal(role.country, 'India')
  assert.equal(role.sourceDetailComplete, true)
  assert.match(role.sourceDescription, /Job Description:/)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

test('the current Jade Global careers search form preserves its exact Workday tenant and site', () => {
  const retained = capture('jadeglobal')
  const html = body(retained.requests[0]).toString()
  assert.equal(hasOfficialCareersPageSignal(html), true)
  assert.equal(extractWorkdayBoardUrl(html), 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers')
})

for (const [label, change] of [
  ['another board', value => value.replaceAll('jadeglobal.wd5.myworkdayjobs.com/Jade_Careers', 'other.wd5.myworkdayjobs.com/Careers')],
  ['an inert form', value => value.replace('<form class="cr-search"', '<form hidden class="cr-search"')],
  ['a disabled submit control', value => value.replace('<button type="submit">Search</button>', '<button disabled type="submit">Search</button>')],
]) test('Jade Global rejects its current careers form when it advertises ' + label, () => {
  const html = body(capture('jadeglobal').requests[0]).toString()
  assert.equal(hasOfficialCareersPageSignal(change(html)), false)
})

test('the registered Twilio source enumerates both current native pages, binds every full detail and closes the complete inventory', async t => {
  replay(t, 'twilio')
  const entry = provider('twilio')
  if (entry.config.rateLimit) entry.config.rateLimit.minimumIntervalMs = 0
  const jobs = await createCatalogScraper(entry).run()
  assert.equal(jobs.length, 15)
  assert.ok(jobs.some(job => job.jobId === 1099556319946), 'The final native page must survive pagination')
  assert.ok(jobs.every(job => job.country === 'India' && job.locations.join() === 'Remote - India'
    && job.jobDescription.length > 100 && new URL(job.link).origin === 'https://jobs.twilio.com'))
  const principal = jobs.find(job => job.jobId === 1099556746356)
  assert.equal(principal.requisitionId, '51165')
  assert.equal(principal.postingDate, '2026-11-02')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, true)
  assert.match(evidence.reason, /opening-and-closing-native-pagination/)
})

test('Twilio rejects a contradictory country on the exact native role', async t => {
  replay(t, 'twilio', payload => {
    const rows = payload.data?.positions || (payload.data?.locations ? [payload.data] : [])
    for (const row of rows) if (row.id === 1099556746356) row.standardizedLocations = ['US']
  })
  const entry = provider('twilio')
  if (entry.config.rateLimit) entry.config.rateLimit.minimumIntervalMs = 0
  await assert.rejects(createCatalogScraper(entry).run(), /contradictory.*country/)
})

test('Twilio still rejects a meaningful native error envelope', async t => {
  replay(t, 'twilio', payload => { if (payload.error) payload.error.message = 'Explicit upstream failure control' })
  const entry = provider('twilio')
  entry.config.rateLimit.minimumIntervalMs = 0
  await assert.rejects(createCatalogScraper(entry).run(), /upstream error response/)
})

test('Twilio keeps proven opening roles incomplete when a closing native identity changes', async t => {
  let firstPageReads = 0
  replay(t, 'twilio', (payload, url) => {
    if (url.pathname.endsWith('/search') && url.searchParams.get('start') === '0' && ++firstPageReads > 1) payload.data.positions[0].name += ' changed'
  })
  const entry = provider('twilio')
  entry.config.rateLimit.minimumIntervalMs = 0
  const jobs = await createCatalogScraper(entry).run()
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(firstPageReads, 2)
})

for (const raw of ['Remote - France (India)', 'Remote - France, India']) test('a remote qualifier cannot conceal contradictory native countries in ' + raw, () => {
  assert.throws(() => readEightfoldLocationScope({ locations: [raw], standardizedLocations: ['IN'] }), /contradictory.*country/)
})

const ericsson = JSON.parse(fs.readFileSync(new URL('ericsson-role.json', directory), 'utf8'))
test('the current Ericsson role retains explicit native countries when its same workplace has only a standardized city', () => {
  const scope = readEightfoldLocationScope(ericsson)
  assert.equal(scope.country, 'India')
  assert.equal(scope.unresolved, false)
  assert.equal(scope.indiaLocations.length, 47)
  assert.ok(scope.indiaLocations.includes('Udhampur,Jammu and Kashmir,India'))
  assert.deepEqual(scope.nativeLocations, ericsson.locations)
  assert.deepEqual(scope.standardizedLocations, ericsson.standardizedLocations)
})

for (const [label, standardized] of [['another city', 'Delhi'], ['a foreign country', 'US']]) {
  test('Ericsson rejects a same-role standardized field naming ' + label, () => {
    const row = structuredClone(ericsson)
    row.standardizedLocations[row.locations.indexOf('Udhampur,Jammu and Kashmir,India')] = standardized
    assert.throws(() => readEightfoldLocationScope(row), error => error.incompleteScope === true)
  })
}
