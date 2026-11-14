import assert from 'node:assert/strict'
import test from 'node:test'
import { run, API_ROOT, BOARD_URL } from './script.js'
import { replay } from './fixtureReplay.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { WorkdayRequestScheduler } from '../../scraper-support/myworkday/requestScheduler.js'

const json = (payload, url, status = 200, headers = {}) => Object.defineProperty(new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json', ...headers } }), 'url', { value: url })

test('Sunrun recovers a transient native 429 while keeping every posting and country check', async () => {
  const fixture = replay(), cooldowns = []
  let attempts = 0
  const jobs = await run({ ...fixture, fetchJson: undefined,
    requestScheduler: { acquire: async () => () => {}, recordRateLimit: (url, delay) => cooldowns.push({ url, delay }) },
    fetch: async (url, request) => {
      if (url === API_ROOT + '/jobs' && attempts++ === 0) return json({}, url, 429, { 'retry-after': '0' })
      return json(await fixture.fetchJson(url, request), url)
    } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 254)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.deepEqual(cooldowns, [{ url: API_ROOT + '/jobs', delay: 0 }])
})

test('Sunrun native detail reads share the Workday shard capacity', async () => {
  const fixture = replay()
  let active = 0, peak = 0
  const jobs = await run({ ...fixture, fetchJson: undefined,
    requestScheduler: new WorkdayRequestScheduler({ minIntervalMs: 0, maxConcurrent: 1 }),
    fetch: async (url, request) => {
      active++; peak = Math.max(peak, active)
      await new Promise(resolve => setImmediate(resolve))
      const payload = await fixture.fetchJson(url, request)
      active--
      return json(payload, url)
    } })
  assert.equal(peak, 1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 254)
})

test('Sunrun reports known maintenance without certifying an empty native board', async () => {
  const fixture = replay(), maintenance = 'https://static.community.workday.com/maintenance-page.html'
  await assert.rejects(run({ ...fixture, fetchPage: async url => url === BOARD_URL
    ? { status: 200, url: maintenance, html: '<html><body>Workday maintenance</body></html>' }
    : fixture.fetchPage(url) }), error => {
    assert.equal(error.abortRetries, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.requestedUrl, BOARD_URL)
    assert.equal(error.responseUrl, maintenance)
    return true
  })
})


test('Sunrun recognizes only its exact native tenant/site outage redirect', async () => {
  const fixture = replay(), redirect = 'https://wd5.myworkday.com/wday/drs/outage?t=sunrun&s=Sunrun_Careers'
  const fetch = async url => {
    if (url === BOARD_URL) return json({}, url, 302, { location: redirect })
    const page = await fixture.fetchPage(url)
    return Object.defineProperty(new Response(page.html, { status: page.status }), 'url', { value: page.url })
  }
  await assert.rejects(run({ fetch }), error => {
    assert.equal(error.abortRetries, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.requestedUrl, BOARD_URL)
    assert.equal(error.redirectUrl, redirect)
    return true
  })
})
