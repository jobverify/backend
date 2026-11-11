import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { getEventListeners } from 'node:events'
import * as wing from '../scraper/wingify/script.js'
import { runNativeInventory, TECHMAHINDRA_NATIVE_AUDIT } from '../scraper/techmahindra/nativeInventory.js'

// Getters and producers below are authored lifecycle protocols, not native
// employer responses. Existing fixture bytes are read without modification.
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network']
const reasonFor = kind => kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'empty' ? ''
  : kind === 'default' ? AbortSignal.abort().reason : kind === 'frozen' ? Object.freeze(Error('Authored frozen caller'))
    : kind === 'network' ? Object.assign(Error('Authored network caller'), { code: 'ECONNRESET' })
      : Object.freeze(Object.assign(Error('Authored frozen network caller'), { code: 'ECONNRESET' }))
const descriptors = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const reflect = promise => Promise.resolve(promise).then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason), 'The exact opaque reason must survive') }
const clean = signals => { for (const signal of new Set(signals)) assert.equal(getEventListeners(signal, 'abort').length, 0) }
const turn = () => new Promise(resolve => setImmediate(resolve))
const routes = { public: options => wing.run(options), factory: options => wing.createWingifyScraper().run(options) }

for (const [route, run] of Object.entries(routes)) for (const kind of kinds) test(`Wingify ${route} pre-abort ${kind} prevents collaborator option extraction`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = []
  caller.abort(reason)
  const options = { get signal() { reads.push('signal'); return caller.signal } }
  for (const name of ['fetchText', 'fetchJson', 'now']) Object.defineProperty(options, name, { get() { reads.push(name); return () => { throw Error('No pre-aborted collaborator may start') } } })
  exact(await reflect(run(options)), reason)
  assert.deepEqual(reads, ['signal']); assert.deepEqual(descriptors(reason), before); clean([caller.signal])
})

for (const key of ['fetchText', 'fetchJson', 'now']) for (const disposition of ['return', 'throw']) for (const kind of kinds) test(`Wingify ${key} getter abort ${kind} then ${disposition} stops later extraction`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = []
  const replacement = Object.freeze(Error('Authored option getter replacement'))
  let transports = 0, clocks = 0
  const options = { signal: caller.signal }
  for (const name of ['fetchText', 'fetchJson', 'now']) Object.defineProperty(options, name, { get() {
    reads.push(name)
    if (name === key) { caller.abort(reason); if (disposition === 'throw') throw replacement }
    return name === 'now' ? () => { clocks++; return '2026-11-11T00:00:00.000Z' } : () => { transports++; throw Error('Cancelled option must never be called') }
  } })
  exact(await reflect(wing.run(options)), reason)
  assert.deepEqual(reads, ['fetchText', 'fetchJson', 'now'].slice(0, ['fetchText', 'fetchJson', 'now'].indexOf(key) + 1))
  assert.equal(transports, 0); assert.equal(clocks, 0); assert.deepEqual(descriptors(reason), before); clean([caller.signal])
})

for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`Wingify factory clock getter abort ${kind} then ${disposition} remains exact`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), replacement = Object.freeze(Error('Authored factory getter replacement'))
  let clocks = 0, transports = 0
  const options = { signal: caller.signal, fetchText() { transports++; throw Error('No transport') } }
  Object.defineProperty(options, 'now', { get() { caller.abort(reason); if (disposition === 'throw') throw replacement; return () => { clocks++; return '' } } })
  exact(await reflect(wing.createWingifyScraper().run(options)), reason)
  assert.equal(transports, 0); assert.equal(clocks, 0); assert.deepEqual(descriptors(reason), before); clean([caller.signal])
})

const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary getter primary'))]]
for (const key of ['fetchText', 'fetchJson', 'now']) for (const [name, primary] of primaries) test(`Wingify ordinary ${key} getter ${name} primary remains exact`, async () => {
  let transports = 0
  const options = { fetchText() { transports++; throw Error('No transport') } }
  Object.defineProperty(options, key, { get() { throw primary } })
  exact(await reflect(wing.run(options)), primary); assert.equal(transports, 0)
})

test('Wingify option getters remain synchronous, read once with their receiver, and preserve ordinary transport identity', async () => {
  const primary = Object.freeze(Error('Authored first transport primary')), reads = [], counts = {}, caller = new AbortController()
  const options = {}
  for (const key of ['fetchText', 'fetchJson', 'now', 'signal']) Object.defineProperty(options, key, { get() {
    assert.equal(this, options); reads.push(key); counts[key] = (counts[key] ?? 0) + 1
    return key === 'signal' ? caller.signal : key === 'now' ? () => { throw Error('Clock must remain after source reads') }
      : key === 'fetchText' ? () => { throw primary } : () => { throw Error('No JSON') }
  } })
  const pending = reflect(wing.createWingifyScraper().run(options))
  assert.deepEqual(counts, { signal: 1, fetchText: 1, fetchJson: 1, now: 1 })
  assert.deepEqual(reads.filter(key => key !== 'signal'), ['fetchText', 'fetchJson', 'now'])
  exact(await pending, primary); clean([caller.signal])
})

test('Wingify explicit null reader stays invalid instead of selecting the default reader', async () => {
  const original = globalThis.fetch
  let defaults = 0
  globalThis.fetch = () => { defaults++; throw Error('No default transport is allowed') }
  let result
  try { result = await reflect(wing.run({ fetchText: null })) } finally { globalThis.fetch = original }
  assert.equal(result.ok, false); assert.ok(result.reason instanceof TypeError); assert.equal(defaults, 0)
})

for (const key of ['html', 'body', 'text']) for (const disposition of ['return', 'throw']) for (const kind of kinds) test(`TechM ${key} getter abort ${kind} then ${disposition} prevents follow-up body work`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = [], signals = []
  const replacement = Object.freeze(Error('Authored response getter replacement'))
  let fetches = 0, bodies = 0, audits = 0
  const result = await reflect(runNativeInventory({ signal: caller.signal, onNativeAudit() { audits++ }, fetchPage(url, init) {
    fetches++; signals.push(init.signal)
    const response = { status: 200, url, headers: new Headers() }
    for (const name of ['html', 'body', 'text']) Object.defineProperty(response, name, { get() {
      reads.push(name)
      if (name === key) { caller.abort(reason); if (disposition === 'throw') throw replacement }
      return name === 'text' ? function () { bodies++; assert.equal(this, response); return 'Authored unreachable body' } : null
    } })
    return response
  } }))
  exact(result, reason); await turn()
  assert.deepEqual(reads, ['html', 'body', 'text'].slice(0, ['html', 'body', 'text'].indexOf(key) + 1))
  assert.equal(fetches, 1); assert.equal(bodies, 0); assert.equal(audits, 0)
  assert.deepEqual(descriptors(reason), before); clean([caller.signal, ...signals])
})

for (const kind of kinds) for (const disposition of ['throw', 'reject']) test(`TechM captured text method abort ${kind} then ${disposition} preserves caller and observes rejection`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), signals = []
  let getters = 0, bodies = 0
  const result = await reflect(runNativeInventory({ signal: caller.signal, fetchPage(url, init) {
    signals.push(init.signal)
    const response = { status: 200, url, headers: new Headers(), get text() {
      getters++
      return function () {
        bodies++; assert.equal(this, response); caller.abort(reason)
        const replacement = Object.freeze(Error('Authored body failure after abort'))
        if (disposition === 'throw') throw replacement
        return Promise.reject(replacement)
      }
    } }
    return response
  } }))
  exact(result, reason); await turn(); await turn()
  assert.equal(getters, 1); assert.equal(bodies, 1); assert.deepEqual(descriptors(reason), before); clean([caller.signal, ...signals])
})

const bps = readFileSync(new URL('../scraper-support/tests/fixtures/techMahindra/native-20261026/bps.html', import.meta.url), 'utf8')
// This adaptation is an authored protocol for method receiver/selection only.
// It is not a newly captured IT response or verified-empty inventory evidence.
const techEmpty = url => url.includes('/BpsOpportunity.aspx') ? bps : bps.replaceAll('BpsOpportunity.aspx', 'CurrentOpportunity.aspx').replaceAll('BPSOpportunity.aspx', 'CurrentOpportunity.aspx').replace('Latest BPS Jobs', 'Latest IT Jobs').replace('No jobs available for BPS', 'No jobs available')
test('TechM captures each normal body method once and calls it with its original response receiver', async () => {
  const signals = []; let getters = 0, bodies = 0, fetches = 0
  const jobs = await runNativeInventory({ fetchPage(url, init) {
    signals.push(init.signal); fetches++
    assert.equal(init.redirect, 'manual')
    const response = { status: 200, url, headers: new Headers(), get text() {
      getters++
      return function () { assert.equal(this, response); bodies++; return Promise.resolve(techEmpty(url)) }
    } }
    return response
  } })
  assert.equal(jobs.length, 0); assert.equal(fetches, 4); assert.equal(getters, 4); assert.equal(bodies, 4)
  assert.equal(jobs[TECHMAHINDRA_NATIVE_AUDIT].responses.length, 4); clean(signals)
})

for (const field of ['html', 'body', 'text']) test(`TechM normal ${field} field preserves nullish selection and avoids unselected readers`, async () => {
  let fetches = 0, selected = 0, unselected = 0
  const jobs = await runNativeInventory({ fetchPage(url) {
    fetches++
    const response = { status: 200, url, headers: new Headers() }
    for (const name of ['html', 'body', 'text']) Object.defineProperty(response, name, { get() {
      if (name === field) { selected++; return techEmpty(url) }
      if (['html', 'body', 'text'].indexOf(name) > ['html', 'body', 'text'].indexOf(field)) { unselected++; throw Error('Selected field must prevent fallback') }
      return null
    } })
    return response
  } })
  // Keep the original second read for a non-function text field; callable
  // methods alone are captured once to prevent later method admission.
  assert.equal(jobs.length, 0); assert.equal(fetches, 4); assert.equal(selected, field === 'text' ? 8 : 4); assert.equal(unselected, 0)
})
test('TechM empty html remains selected instead of falling through to a body method', async () => {
  let bodyReads = 0
  const jobs = await runNativeInventory({ fetchPage(url) { return { status: 200, url, html: '', get body() { bodyReads++; throw Error('No body fallback') }, headers: new Headers() } } })
  assert.equal(bodyReads, 0); assert.equal(jobs[TECHMAHINDRA_NATIVE_AUDIT].responses.length, 2)
  assert.ok(jobs[TECHMAHINDRA_NATIVE_AUDIT].responses.every(response => response.bytes === 0))
})

for (const field of ['html', 'body', 'text']) for (const type of ['promise', 'thenable', 'object', 'number', 'buffer']) test(`TechM ${field} ${type} remains an invalid unassimilated field`, async () => {
  let thenReads = 0
  const value = type === 'promise' ? Promise.resolve('Authored field must remain invalid')
    : type === 'thenable' ? { get then() { thenReads++; throw Error('Unsupported field must not be assimilated') } }
      : type === 'object' ? {} : type === 'number' ? 42 : Buffer.from('Authored invalid field')
  const jobs = await runNativeInventory({ fetchPage(url) { return { status: 200, url, headers: new Headers(), [field]: value } } })
  const audit = jobs[TECHMAHINDRA_NATIVE_AUDIT]
  assert.equal(jobs.length, 0); assert.equal(audit.responses.length, 0); assert.equal(thenReads, 0)
  assert.ok(audit.limitations.some(reason => reason.includes('transport did not return HTML')))
})

test('TechM ordinary frozen body getter error retains the existing scope failure classification', async () => {
  const primary = Object.freeze(Error('Authored ordinary body getter primary')), before = descriptors(primary)
  let calls = 0
  const jobs = await runNativeInventory({ fetchPage(url) { calls++; return { status: 200, url, get text() { throw primary } } } })
  const audit = jobs[TECHMAHINDRA_NATIVE_AUDIT]
  assert.equal(calls, 2); assert.equal(audit.responses.length, 0)
  assert.ok(audit.limitations.includes('IT:' + primary.message)); assert.ok(audit.limitations.includes('BPS:' + primary.message))
  assert.deepEqual(descriptors(primary), before)
})
