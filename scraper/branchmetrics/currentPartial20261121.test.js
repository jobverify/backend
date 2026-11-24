import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { run, API_URL, BOARD_URL } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-partial-20261121.json.gz', import.meta.url))))
const bodies = new Map(packets.map(packet => [packet.requestedUrl, packet.body]))
const indiaId = '454f3d28-ca85-4640-9cfe-c48f1931cfdc'
const indiaUrl = BOARD_URL + '/' + indiaId
const nativeRole = /^https:\/\/ats\.rippling\.com\/branch\/jobs\//
const originalTimeout = AbortSignal.timeout.bind(AbortSignal)
const accelerateDeadline = t => t.mock.method(AbortSignal, 'timeout', milliseconds => originalTimeout(milliseconds === 120000 ? 25 : milliseconds))
const keepAlive = t => { const timer = setTimeout(() => {}, 1000); t.after(() => clearTimeout(timer)) }
const knownBody = url => {
  if (!bodies.has(url)) throw new Error('Uncaptured public response ' + url)
  return bodies.get(url)
}
const checkPartial = jobs => {
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, indiaId)
  assert.equal(jobs[0].title, 'Technical Project Manager')
  assert.equal(jobs[0].postingDate, '2026-10-12T23:58:53.547000-07:00')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].country, 'India')
  assert.deepEqual(jobs[0].sourceNativeWorkLocations, ['Bengaluru, India', 'London, United Kingdom'])
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.ok(jobs[0].jobDescription.includes('mobile marketing measurement and deep linking solutions'))
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
}

test('Branch source deadline preserves independently validated India criteria before remaining native details', async t => {
  accelerateDeadline(t); keepAlive(t)
  const calls = []
  const jobs = await run({ fetchText: async url => {
    calls.push(url)
    if (nativeRole.test(url) && url !== indiaUrl) return new Promise(() => {})
    return knownBody(url)
  } })
  checkPartial(jobs)
  assert.equal(calls.find(url => nativeRole.test(url)), indiaUrl)
  assert.match(readInventoryEvidence(jobs).reason, /source-deadline/)
})

test('Branch closing transport failure retains validated India observations without certifying membership', async () => {
  let lists = 0
  const jobs = await run({ fetchText: async url => {
    if (url === API_URL && ++lists === 2) throw new Error('public closing HTTP503')
    return knownBody(url)
  } })
  checkPartial(jobs)
  assert.match(readInventoryEvidence(jobs).reason, /closing-transport/)
})

test('Branch spends its existing source budget on independent board and declared API reads', async t => {
  accelerateDeadline(t); keepAlive(t)
  let finishBoard, lists = 0
  const jobs = await run({ fetchText: async url => {
    if (url === BOARD_URL) return new Promise(resolve => { finishBoard = resolve })
    if (url === API_URL) {
      if (++lists === 2) throw new Error('public closing HTTP503')
      finishBoard(knownBody(BOARD_URL))
    }
    return knownBody(url)
  } })
  checkPartial(jobs)
})

test('Branch default transport honors the source budget instead of timing out a valid slower public response early', async t => {
  t.mock.method(AbortSignal, 'timeout', milliseconds => originalTimeout(milliseconds === 120000 ? 250 : Math.min(milliseconds, 5)))
  keepAlive(t)
  let lists = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'manual')
    if (url === BOARD_URL) await delay(10, undefined, { signal: options.signal })
    if (url === API_URL && ++lists === 2) throw new Error('public closing HTTP503')
    const body = knownBody(url)
    return { status: 200, url, text: async () => body }
  })
  checkPartial(await run())
})

test('Branch explicit caller abort wins over a simultaneous local deadline and returns the exact reason', async t => {
  const caller = new AbortController(), deadline = new AbortController()
  const reason = { message: 'root caller deliberately cancelled' }
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let timer
  t.after(() => clearTimeout(timer))
  await assert.rejects(run({ signal: caller.signal, fetchText: async url => {
    if (nativeRole.test(url) && url !== indiaUrl) {
      timer ||= setTimeout(() => {
        deadline.abort(new DOMException('owned deadline', 'TimeoutError'))
        caller.abort(reason)
      }, 5)
      return new Promise(() => {})
    }
    return knownBody(url)
  } }), error => error === reason)
})

test('Branch deadline before native ownership and inventory proof still throws', async t => {
  accelerateDeadline(t); keepAlive(t)
  await assert.rejects(run({ fetchText: async () => new Promise(() => {}) }), error => error.name === 'TimeoutError')
})

test('Branch closing schema and membership conflicts remain strict after successful role validation', async () => {
  for (const change of [
    () => '{not-json',
    () => null,
    body => { const value = JSON.parse(body); value.items[0].name = 'Conflicting current title'; return JSON.stringify(value) },
    body => { const value = JSON.parse(body); value.totalItems++; return JSON.stringify(value) },
  ]) {
    let lists = 0
    await assert.rejects(run({ fetchText: async url => {
      if (url === API_URL && ++lists === 2) return change(knownBody(url))
      return knownBody(url)
    } }), /JSON|native|Unexpected/)
  }
})

test('Branch partial recovery cannot retain conflicting employer, same-ID, workplace or hidden criteria', async () => {
  for (const change of [
    job => { job.companyName = 'Another employer' },
    job => { job.uuid = '00000000-0000-0000-0000-000000000000' },
    job => { job.workLocations = ['Bengaluru, India'] },
    job => { job.description.role = '<div hidden>' + job.description.role + '</div>' },
  ]) {
    const html = knownBody(indiaUrl).replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/i, (_match, start, json, end) => {
      const payload = JSON.parse(json); change(payload.props.pageProps.apiData.jobPost)
      return start + JSON.stringify(payload).replace(/</g, '\\u003c') + end
    })
    let lists = 0
    const jobs = await run({ fetchText: async url => {
      if (url === API_URL && ++lists === 2) throw new Error('public closing HTTP503')
      return url === indiaUrl ? html : knownBody(url)
    } })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  }
})

test('Branch closing response redirect identity remains strict on the default transport', async t => {
  let lists = 0
  t.mock.method(globalThis, 'fetch', async url => ({
    status: 200,
    url: url === API_URL && ++lists === 2 ? 'https://foreign.example/jobs' : url,
    text: async () => knownBody(url),
  }))
  await assert.rejects(run(), /redirect identity/)
})

test('Branch incomplete current native countries and same-ID conflicts never acquire partial positive evidence', async () => {
  for (const change of [
    value => { value.items[0].locations[0].countryCode = 'IN' },
    value => { value.items[1].name = 'Conflicting same-ID title' },
  ]) {
    await assert.rejects(run({ fetchText: async url => {
      if (url !== API_URL) return knownBody(url)
      const value = JSON.parse(knownBody(url)); change(value); return JSON.stringify(value)
    } }), /country|conflicting|board and public API/)
  }
})
