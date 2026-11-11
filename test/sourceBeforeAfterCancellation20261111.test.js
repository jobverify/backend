import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runNativeInventory } from '../scraper/techmahindra/nativeInventory.js'
import { run as runTechMahindra } from '../scraper/techmahindra/script.js'
import * as wingify from '../scraper/wingify/script.js'

// Authored cancellation/producer controls exercise actual source exports.
// Existing fixture bytes remain unchanged. The BPS-to-IT empty-page adaptation
// below is an authored protocol model, not a newly captured native IT response.
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'native']
const reasonFor = kind => ({ null: null, false: false, zero: 0, empty: '',
  frozen: Object.freeze(Error('Authored frozen caller reason')), native: AbortSignal.abort().reason })[kind]
const describe = reason => reason && typeof reason === 'object' ? Object.getOwnPropertyDescriptors(reason) : null
const outcomeOf = promise => Promise.resolve(promise).then(value => ({ fulfilled: true, value }), value => ({ fulfilled: false, value }))
const nextTurn = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const assertReason = (outcome, reason, before) => {
  assert.equal(outcome.fulfilled, false)
  assert.ok(Object.is(outcome.value, reason), 'exact caller reason must survive')
  assert.deepEqual(describe(reason), before, 'caller reason must not be mutated')
}
const assertClean = signals => {
  for (const signal of new Set(signals.filter(Boolean))) assert.equal(getEventListeners(signal, 'abort').length, 0)
}
const specs = [
  { name: 'TechMahindra native', run: runNativeInventory, option: 'fetchPage' },
  { name: 'TechMahindra public', run: runTechMahindra, option: 'fetchPage' },
  { name: 'Wingify public', run: wingify.run, option: 'fetchText' },
  { name: 'Wingify factory', run: options => wingify.createWingifyScraper().run(options), option: 'fetchText' },
]
const primary = [specs[0], specs[2]]
for (const spec of primary) for (const kind of kinds) test(`${spec.name} cancels ${kind} before queued transport admission`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  let calls = 0
  const pending = outcomeOf(spec.run({ signal: controller.signal, [spec.option]: () => { calls++; throw Error('Queued transport must not start') } }))
  controller.abort(reason)
  assertReason(await pending, reason, before)
  assert.equal(calls, 0)
  assertClean([controller.signal])
})
for (const spec of specs) for (const kind of kinds) test(`${spec.name} rejects pre-aborted ${kind} without admitting transport`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  controller.abort(reason)
  let calls = 0
  const outcome = await outcomeOf(spec.run({ signal: controller.signal, [spec.option]: () => { calls++; throw Error('Unavailable authored transport') } }))
  assertReason(outcome, reason, before)
  assert.equal(calls, 0)
  assertClean([controller.signal])
})

for (const spec of primary) for (const kind of kinds) {
  for (const disposition of ['return', 'throw']) test(`${spec.name} keeps ${kind} when synchronous transport aborts then ${disposition}s`, async () => {
    const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), signals = []
    let calls = 0
    const outcome = await outcomeOf(spec.run({ signal: controller.signal, [spec.option]: (_url, { signal }) => {
      signals.push(signal); calls++; controller.abort(reason)
      if (disposition === 'throw') throw Error('Authored later transport error')
      return spec.option === 'fetchPage' ? { html: 'Unreachable after caller abort' } : 'Unreachable after caller abort'
    } }))
    assertReason(outcome, reason, before)
    assert.equal(calls, 1)
    assertClean([controller.signal, ...signals])
  })
  for (const late of ['resolve', 'reject']) test(`${spec.name} settles ${kind} before uncooperative transport later ${late}s`, async () => {
    const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
    const entered = deferred(), operation = deferred(), signals = []
    let calls = 0, settled = false
    const observed = outcomeOf(spec.run({ signal: controller.signal, [spec.option]: (_url, { signal }) => {
      signals.push(signal); calls++; entered.resolve(); return operation.promise
    } })).then(value => { settled = true; return value })
    await entered.promise
    controller.abort(reason)
    try {
      await nextTurn()
      assert.equal(settled, true, 'caller cancellation must settle without transport cooperation')
    } finally {
      if (late === 'reject') operation.reject(Error('Authored late transport rejection'))
      else operation.resolve(spec.option === 'fetchPage' ? { html: 'Unreachable' } : 'Unreachable')
    }
    assertReason(await observed, reason, before)
    await nextTurn()
    assert.equal(calls, 1)
    assertClean([controller.signal, ...signals])
  })
}

for (const kind of kinds) for (const late of ['resolve', 'reject']) test(`TechMahindra settles ${kind} before a response body later ${late}s`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  const entered = deferred(), body = deferred(), signals = []
  let calls = 0, settled = false
  const observed = outcomeOf(runNativeInventory({ signal: controller.signal, fetchImpl: (url, { signal }) => {
    signals.push(signal); calls++
    return { url, status: 200, ok: true, headers: new Headers(), text() { entered.resolve(); return body.promise } }
  } })).then(value => { settled = true; return value })
  await entered.promise
  controller.abort(reason)
  try { await nextTurn(); assert.equal(settled, true, 'body wait must observe cancellation') }
  finally { if (late === 'reject') body.reject(Error('Authored late body error')); else body.resolve('Unreachable') }
  assertReason(await observed, reason, before)
  await nextTurn()
  assert.equal(calls, 1)
  assertClean([controller.signal, ...signals])
})

for (const kind of kinds) for (const late of ['resolve', 'reject']) test(`Wingify default reader retains ${kind} during body wait and late ${late}`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  const entered = deferred(), body = deferred(), signals = [], originalFetch = globalThis.fetch
  let calls = 0, settled = false
  globalThis.fetch = (url, { signal }) => {
    signals.push(signal); calls++
    return { url, status: 200, ok: true, headers: new Headers(), text() { entered.resolve(); return body.promise } }
  }
  const observed = outcomeOf(wingify.run({ signal: controller.signal })).then(value => { settled = true; return value })
  try {
    await entered.promise
    controller.abort(reason)
    await nextTurn()
    assert.equal(settled, true)
  } finally {
    if (late === 'reject') body.reject(Error('Authored late shared-body error')); else body.resolve('Unreachable')
    globalThis.fetch = originalFetch
  }
  assertReason(await observed, reason, before)
  await nextTurn()
  assert.equal(calls, 1)
  assertClean([controller.signal, ...signals])
})

const root = new URL('../scraper-support/tests/fixtures/', import.meta.url)
const bps = readFileSync(new URL('techMahindra/native-20261026/bps.html', root), 'utf8')
const techEmpty = url => url.includes('/BpsOpportunity.aspx') ? bps : bps
  .replaceAll('BpsOpportunity.aspx', 'CurrentOpportunity.aspx').replaceAll('BPSOpportunity.aspx', 'CurrentOpportunity.aspx')
  .replace('Latest BPS Jobs', 'Latest IT Jobs').replace('No jobs available for BPS', 'No jobs available')
const techReplay = change => {
  const calls = [], signals = []
  return { calls, signals, fetchPage(url, init) {
    calls.push(url); signals.push(init.signal)
    const response = { url, status: 200, headers: new Headers(), text: () => techEmpty(url) }
    return change?.(response, calls.length) ?? response
  } }
}
const wingText = name => readFileSync(new URL('wingify/' + name, root), 'utf8')
const wingJson = name => JSON.parse(wingText(name))
const kekaPages = wingJson('keka-detail-pages.json'), abPages = wingJson('abtasty-detail-pages.json')
const wingReplay = change => {
  const calls = [], signals = []
  let textCalls = 0
  return { calls, signals, now: () => '2026-10-08T19:30:00.000Z',
    fetchJson(url, { signal }) {
      calls.push(url); signals.push(signal)
      const file = url === wingify.CAREER_PORTAL_INFO_URL ? 'keka-portal-info.json'
        : url === wingify.FIRST_PARTY_JOBS_URL ? 'first-party-jobs.json'
          : url === wingify.ACTIVE_JOBS_URL ? 'keka-active-jobs.json' : null
      assert.ok(file, 'Only existing fixture JSON routes are allowed')
      return wingJson(file)
    },
    fetchText(url, { signal }) {
      calls.push(url); signals.push(signal); textCalls++
      const body = url === wingify.CAREERS_URL ? wingText('careers-current.html')
        : url === wingify.KEKA_BOARD_URL ? wingText('keka-board-current.html')
          : url === wingify.AB_TASTY_BOARD_URL ? wingText('abtasty-jobs-current.html')
            : url === wingify.AB_TASTY_RSS_URL ? wingText('abtasty-jobs.rss')
              : url.startsWith('https://wingify.keka.com/careers/jobdetails/') ? kekaPages[url.split('/').pop()]
                : abPages[url.split('/').pop().split('-')[0]]
      assert.ok(body, 'Only existing fixture text routes are allowed')
      return change ? change(body, textCalls) : body
    } }
}
for (const kind of kinds) for (const disposition of ['return', 'throw', 'resolve', 'reject']) test(`Wingify JSON abort ${kind} then ${disposition} preserves reason and stops later reads`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), replay = wingReplay()
  const entered = deferred(), pending = deferred()
  let reads = 0, settled = false
  const observed = outcomeOf(wingify.run({ ...replay, signal: controller.signal, fetchJson(_url, { signal }) {
    assert.equal(signal, controller.signal); reads++; entered.resolve()
    if (disposition === 'return' || disposition === 'throw') {
      controller.abort(reason)
      if (disposition === 'throw') throw Error('Authored JSON producer error')
      return {}
    }
    return pending.promise
  } })).then(value => { settled = true; return value })
  await entered.promise
  controller.abort(reason)
  try { await nextTurn(); assert.equal(settled, true, 'JSON wait must settle without producer cooperation') }
  finally { if (disposition === 'reject') pending.reject(Error('Authored late JSON error')); else pending.resolve({}) }
  assertReason(await observed, reason, before)
  await nextTurn()
  assert.equal(reads, 1)
  assert.equal(replay.calls.length, 2, 'Only the two handoff text reads precede the first JSON request')
  assertClean([controller.signal, ...replay.signals])
})
for (const kind of kinds) test(`TechMahindra final body abort ${kind} stops audit notification and success`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  const replay = techReplay((response, count) => count === 4 ? { ...response, text() { controller.abort(reason); return techEmpty(response.url) } } : response)
  let audits = 0
  const outcome = await outcomeOf(runNativeInventory({ ...replay, signal: controller.signal, onNativeAudit() { audits++ } }))
  assertReason(outcome, reason, before)
  assert.equal(audits, 0)
  assert.equal(replay.calls.length, 4)
  assertClean([controller.signal, ...replay.signals])
})
for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`Wingify text conversion abort ${kind} then ${disposition} preserves reason`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  let calls = 0
  const outcome = await outcomeOf(wingify.run({ signal: controller.signal, fetchText() {
    calls++
    return { [Symbol.toPrimitive]() { controller.abort(reason); if (disposition === 'throw') throw Error('Authored conversion error'); return 'Unreachable after abort' } }
  } }))
  assertReason(outcome, reason, before)
  assert.equal(calls, 1)
  assertClean([controller.signal])
})
for (const kind of kinds) test(`Wingify last text conversion abort ${kind} prevents queued clock`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController()
  let clocks = 0, conversions = 0
  const replay = wingReplay((body, count) => count === 35 ? { [Symbol.toPrimitive]() { conversions++; controller.abort(reason); return body } } : body)
  const outcome = await outcomeOf(wingify.run({ ...replay, signal: controller.signal, now() { clocks++; return '2026-10-08T19:30:00.000Z' } }))
  assertReason(outcome, reason, before)
  assert.equal(conversions, 1)
  assert.equal(clocks, 0)
  assertClean([controller.signal, ...replay.signals])
})
for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`Wingify clock abort ${kind} then ${disposition} preserves reason`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), replay = wingReplay()
  let clocks = 0
  const outcome = await outcomeOf(wingify.run({ ...replay, signal: controller.signal, now() {
    clocks++; controller.abort(reason); if (disposition === 'throw') throw Error('Authored clock error'); return '2026-10-08T19:30:00.000Z'
  } }))
  assertReason(outcome, reason, before)
  assert.equal(clocks, 1)
  assertClean([controller.signal, ...replay.signals])
})
for (const stage of ['initial', 'final']) for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`TechMahindra ${stage} clock abort ${kind} then ${disposition} preserves reason`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), replay = techReplay()
  const original = Date.prototype.toISOString
  let clocks = 0, audits = 0
  Date.prototype.toISOString = function () {
    clocks++
    if (clocks === (stage === 'initial' ? 1 : 2)) { controller.abort(reason); if (disposition === 'throw') throw Error('Authored date producer error') }
    return original.call(this)
  }
  let outcome
  try { outcome = await outcomeOf(runNativeInventory({ ...replay, signal: controller.signal, onNativeAudit() { audits++ } })) }
  finally { Date.prototype.toISOString = original }
  assertReason(outcome, reason, before)
  assert.equal(audits, 0)
  assert.equal(replay.calls.length, stage === 'initial' ? 0 : 4)
  assertClean([controller.signal, ...replay.signals])
})
for (const kind of kinds) for (const disposition of ['return', 'throw', 'pending']) test(`TechMahindra audit abort ${kind} then ${disposition} preserves reason`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), replay = techReplay()
  const entered = deferred(), pending = deferred()
  let settled = false, audits = 0
  const options = { ...replay, signal: controller.signal, onNativeAudit() {
    assert.equal(this, options); audits++; entered.resolve(); controller.abort(reason)
    if (disposition === 'throw') throw Error('Authored observer error')
    return disposition === 'pending' ? pending.promise : undefined
  } }
  const observed = outcomeOf(runNativeInventory(options)).then(value => { settled = true; return value })
  await entered.promise
  try { await nextTurn(); assert.equal(settled, true, 'aborted observer must not block completion') }
  finally { pending.reject(Error('Authored late observer rejection')); if (disposition !== 'pending') await pending.promise.catch(() => {}) }
  assertReason(await observed, reason, before)
  await nextTurn()
  assert.equal(audits, 1)
  assertClean([controller.signal, ...replay.signals])
})
for (const kind of kinds) test(`TechMahindra audit getter abort ${kind} prevents callback admission`, async () => {
  const reason = reasonFor(kind), before = describe(reason), controller = new AbortController(), replay = techReplay()
  let audits = 0
  const options = { ...replay, signal: controller.signal }
  Object.defineProperty(options, 'onNativeAudit', { get() { controller.abort(reason); return () => { audits++ } } })
  const outcome = await outcomeOf(runNativeInventory(options))
  assertReason(outcome, reason, before)
  assert.equal(audits, 0)
  assertClean([controller.signal, ...replay.signals])
})
test('Wingify uncancelled transport failure preserves exact error', async () => {
  const error = Object.freeze(Error('Authored unchanged transport failure'))
  assert.equal((await outcomeOf(wingify.run({ fetchText: () => { throw error } }))).value, error)
})
test('TechMahindra uncancelled audit failure preserves exact error and receiver', async () => {
  const error = Object.freeze(Error('Authored unchanged observer failure')), replay = techReplay()
  const options = { ...replay, onNativeAudit() { assert.equal(this, options); throw error } }
  assert.equal((await outcomeOf(runNativeInventory(options))).value, error)
  assertClean(replay.signals)
})

for (const field of ['html', 'body']) test(`TechMahindra keeps promise-valued ${field} invalid instead of awaiting it as HTML`, async () => {
  const replay = techReplay(response => ({ ...response, [field]: Promise.resolve(techEmpty(response.url)) }))
  const jobs = await runNativeInventory(replay)
  const audit = jobs[Symbol.for('jobverify.techmahindra-native-audit')]
  assert.equal(jobs.length, 0)
  assert.equal(replay.calls.length, 2)
  assert.equal(audit.responses.length, 0)
  assert.ok(Object.values(audit.scopes).every(scope => !scope.paginationComplete && !scope.closingStable))
  assert.ok(audit.limitations.some(reason => reason.includes('transport did not return HTML')))
  assertClean(replay.signals)
})
