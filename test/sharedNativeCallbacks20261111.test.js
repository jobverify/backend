import assert from 'node:assert/strict'
import test from 'node:test'
import { createCommvaultClumioScraper } from '../scraper-support/native-sources/commvaultClumio/nativeCareers.js'
import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import { createNativeGreenhouseScraper, NATIVE_GREENHOUSE_PROFILES } from '../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'

// Authored callback and unavailable-transport controls only. No employer HTTP
// response, native model, role, criteria, country or inventory fact is supplied.
const now = '2026-11-11T00:00:00.000Z'
const reasons = [['null', null], ['false', false], ['zero', 0], ['empty', ''],
  ['frozen', Object.freeze(Error('Authored frozen cancellation'))], ['default', AbortSignal.abort().reason]]
const unavailable = Object.freeze(Error('Authored unavailable transport; no HTTP response'))
const owned = [
  { name: 'CommvaultClumio', factory: () => createCommvaultClumioScraper() },
  { name: 'DeclaredJobFeeds', factory: () => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.prefect) },
]
const positive = { name: 'unchanged DeclaredGreenhouse', factory: () => createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES.doximity) }
const reflect = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.pending, undefined); assert.equal(result.ok, false); assert.equal(result.reason, reason) }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const turn = () => new Promise(resolve => setImmediate(resolve))
const bounded = async promise => { let timer; try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve({ pending: true }), 100) })]) } finally { clearTimeout(timer) } }
const invoke = (api, options = {}) => api.factory().run({ now: () => now, fetchPage: async () => { throw unavailable }, ...options })

// The original 72 exported-interface cases, with admission assertions as well as
// exact identity. The unchanged third helper is the positive control.
for (const api of [...owned, positive]) for (const stage of ['clock', 'audit']) for (const kind of ['abort-return', 'abort-throw']) for (const [label, reason] of reasons) {
  test(api.name + ' ' + stage + ' ' + kind + ' preserves ' + label + ' and stops follow-up callbacks', async () => {
    const caller = new AbortController(), replacement = Object.freeze(Error('Authored callback replacement'))
    let fetches = 0, clocks = 0, audits = 0, records = 0
    const abort = () => { caller.abort(reason); if (kind === 'abort-throw') throw replacement }
    const result = await reflect(invoke(api, { signal: caller.signal,
      fetchPage: async () => { fetches++; throw unavailable },
      now: () => { clocks++; if (stage === 'clock') abort(); return now },
      onAudit: () => { audits++; if (stage === 'audit') abort() }, onRecords: () => { records++ } }))
    exact(result, reason); assert.equal(clocks, 1); assert.equal(records, 0)
    assert.equal(audits, stage === 'clock' ? 0 : 1)
    if (stage === 'clock') assert.equal(fetches, 0)
    else assert.ok(fetches > 0, 'Audit must be reached through unavailable transport collection')
  })
}

for (const api of owned) {
  for (const kind of ['abort-return', 'abort-throw']) for (const [label, reason] of reasons) {
    test(api.name + ' records ' + kind + ' preserves ' + label + ' at terminal return', async () => {
      const caller = new AbortController(); let audits = 0, records = 0
      const result = await reflect(invoke(api, { signal: caller.signal, onAudit: () => { audits++ },
        onRecords: () => { records++; caller.abort(reason); if (kind === 'abort-throw') throw Error('Authored records replacement') } }))
      exact(result, reason); assert.equal(audits, 1); assert.equal(records, 1)
    })
  }
  for (const stage of ['onAudit', 'onRecords']) {
    for (const [label, reason] of reasons) test(api.name + ' asynchronous ' + stage + ' abort then rejection preserves ' + label, async () => {
      const caller = new AbortController(); let audits = 0, records = 0
      const options = { signal: caller.signal, onAudit: () => { audits++ }, onRecords: () => { records++ } }
      options[stage] = async () => { if (stage === 'onAudit') audits++; else records++; await Promise.resolve(); caller.abort(reason); throw Error('Authored async observer replacement') }
      exact(await reflect(invoke(api, options)), reason); assert.equal(audits, 1); assert.equal(records, stage === 'onAudit' ? 0 : 1)
    })
    for (const [label, original] of [['frozen', Object.freeze(Error('Authored ordinary observer error'))], ['false', false]]) {
      test(api.name + ' uncancelled ' + stage + ' rejection preserves original ' + label, async () => {
        let audits = 0, records = 0
        const options = { onAudit: () => { audits++ }, onRecords: () => { records++ } }
        options[stage] = async () => { if (stage === 'onAudit') audits++; else records++; throw original }
        exact(await reflect(invoke(api, options)), original); assert.equal(audits, 1); assert.equal(records, stage === 'onAudit' ? 0 : 1)
      })
    }
    for (const late of ['fulfill', 'reject']) test(api.name + ' stalled ' + stage + ' releases caller and owns late ' + late, async () => {
      const caller = new AbortController(), entered = deferred(), release = deferred(); let audits = 0, records = 0
      const reason = late === 'reject' ? false : null
      const options = { signal: caller.signal, onAudit: () => { audits++ }, onRecords: () => { records++ } }
      options[stage] = () => { if (stage === 'onAudit') audits++; else records++; entered.resolve(); return release.promise }
      const pending = reflect(invoke(api, options))
      await entered.promise; caller.abort(reason); const early = await bounded(pending)
      if (late === 'reject') release.reject(Error('Authored late observer rejection'))
      else release.resolve('Authored late observer completion')
      await pending; await turn(); exact(early, reason); assert.equal(audits, 1); assert.equal(records, stage === 'onAudit' ? 0 : 1)
    })
  }
  for (const [label, reason] of reasons) {
    test(api.name + ' queued audit cancellation prevents records for ' + label, async () => {
      const caller = new AbortController(); let audits = 0, records = 0
      const result = await reflect(invoke(api, { signal: caller.signal,
        onAudit: () => { audits++; queueMicrotask(() => caller.abort(reason)) }, onRecords: () => { records++ } }))
      exact(result, reason); assert.equal(audits, 1); assert.equal(records, 0)
    })
    test(api.name + ' transport abort and fatal replacement prevent diagnostic admission for ' + label, async () => {
      const caller = new AbortController(); let fetches = 0, audits = 0, records = 0
      const result = await reflect(invoke(api, { signal: caller.signal,
        fetchPage: async () => { fetches++; caller.abort(reason); throw Error('Authored transport replacement') },
        onAudit: () => { audits++ }, onRecords: () => { records++ } }))
      exact(result, reason); assert.equal(fetches, 1); assert.equal(audits, 0); assert.equal(records, 0)
    })
    test(api.name + ' pre-aborted ' + label + ' admits no clock or transport or observers', async () => {
      const caller = new AbortController(); caller.abort(reason); let calls = 0
      const forbidden = () => { calls++; assert.fail('Pre-aborted collaborator admitted') }
      exact(await reflect(invoke(api, { signal: caller.signal, now: forbidden, fetchPage: forbidden, onAudit: forbidden, onRecords: forbidden })), reason)
      assert.equal(calls, 0)
    })
  }
  for (const observer of ['succeed', 'onAudit', 'onRecords']) {
    test(api.name + ' uncancelled fatal collection preserves diagnostic order and ' + observer + ' precedence', async () => {
      const fatal = Object.freeze(Error('Authored fatal error while recording unavailable transport')), callbackError = Object.freeze(Error('Authored diagnostic callback error'))
      // The actual exported IO error path reads error.name. This synthetic
      // throwing accessor supplies a collection fatal without an HTTP response.
      const failure = Object.defineProperty(Error('Authored unavailable transport'), 'name', { get() { throw fatal } })
      const order = []
      const result = await reflect(invoke(api, { fetchPage: async () => { throw failure },
        onAudit: audit => { order.push('audit'); assert.equal(audit.lifecycleCleanupAllowed, false); assert.equal(audit.sourceScopeComplete, false); if (observer === 'onAudit') throw callbackError },
        onRecords: all => { order.push('records'); assert.deepEqual(all, []); if (observer === 'onRecords') throw callbackError } }))
      exact(result, observer === 'succeed' ? fatal : callbackError)
      assert.deepEqual(order, observer === 'onAudit' ? ['audit'] : ['audit', 'records'])
    })
  }
  test(api.name + ' ordinary synchronous clock error retains identity and skips all later work', async () => {
    const original = Object.freeze(Error('Authored ordinary clock failure')); let calls = 0
    const forbidden = () => { calls++; assert.fail('Work admitted after clock error') }
    exact(await reflect(invoke(api, { now: () => { throw original }, fetchPage: forbidden, onAudit: forbidden, onRecords: forbidden })), original)
    assert.equal(calls, 0)
  })
  test(api.name + ' invalid synchronous clock is still rejected before transport', async () => {
    let calls = 0
    const result = await reflect(invoke(api, { now: () => 'not-an-observation-date', fetchPage: async () => { calls++; throw unavailable } }))
    assert.equal(result.ok, false); assert.match(result.reason.message, /Invalid observation clock/); assert.equal(calls, 0)
  })
  test(api.name + ' successful diagnostic snapshots remain detached and callback arguments unchanged', async () => {
    const order = []
    const jobs = await invoke(api, { onAudit: (...args) => { assert.equal(args.length, 1); order.push('audit'); args[0].observations.push({ authoredMutation: true }); return false },
      onRecords: (...args) => { assert.equal(args.length, 1); order.push('records'); assert.deepEqual(args[0], []); args[0].push({ authoredMutation: true }); return null } })
    assert.deepEqual(order, ['audit', 'records']); assert.equal(jobs.length, 0); assert.deepEqual(jobs.sourceAudit.observations, [])
    assert.equal(jobs.sourceAudit.sourceScopeComplete, false); assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  })
  for (const stage of ['onAudit', 'onRecords']) test(api.name + ' cancellation while preparing ' + stage + ' arguments blocks callback admission', async t => {
    const caller = new AbortController(), originalClone = globalThis.structuredClone
    let auditCompleted = false, audits = 0, records = 0, aborted = false
    t.mock.method(globalThis, 'structuredClone', value => {
      const target = stage === 'onAudit' ? value?.observations && value?.rawPages : auditCompleted && Array.isArray(value)
      if (target && !aborted) { aborted = true; caller.abort(false) }
      return originalClone(value)
    })
    const result = await reflect(invoke(api, { signal: caller.signal,
      onAudit: () => { audits++; auditCompleted = true }, onRecords: () => { records++ } }))
    exact(result, false); assert.equal(aborted, true); assert.equal(audits, stage === 'onAudit' ? 0 : 1); assert.equal(records, 0)
  })
}
test('Declared feed accepts its existing literal observation clock option', async () => {
  const jobs = await invoke(owned[1], { now }); assert.equal(jobs.length, 0); assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
})
test('Commvault keeps its existing function-only observation clock API', async () => {
  let calls = 0
  const result = await reflect(invoke(owned[0], { now, fetchPage: async () => { calls++; throw unavailable } }))
  assert.equal(result.ok, false); assert.ok(result.reason instanceof TypeError); assert.equal(calls, 0)
})

