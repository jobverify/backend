import assert from 'node:assert/strict'
import test from 'node:test'
import { createCommvaultClumioScraper } from '../scraper-support/native-sources/commvaultClumio/nativeCareers.js'
import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'

// Authored exceptional-error-accessor collection failures only. No original
// employer response, native role, criteria, country or inventory is supplied.
const apis = [
  { name: 'CommvaultClumio', factory: () => createCommvaultClumioScraper() },
  { name: 'DeclaredJobFeeds', factory: () => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.prefect) },
]
const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''],
  ['frozen', Object.freeze(Error('Authored original fatal collection error'))]]
const callerReasons = [null, false, 0, '', Object.freeze(Error('Authored caller error')), AbortSignal.abort().reason]
const reflect = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, expected) => { assert.equal(result.ok, false); assert.equal(result.reason, expected) }
const run = async (api, primary, callbacks = {}) => {
  const order = []; let fetches = 0, nameReads = 0, audits = 0, records = 0
  const unavailablePrimary = Error('Authored unavailable primary transport, no HTTP response')
  const failure = Object.defineProperty(Error('Authored unavailable secondary transport, no HTTP response'), 'name', { get() { nameReads++; throw primary } })
  const result = await reflect(api.factory().run({ now: () => '2026-11-11T00:00:00.000Z',
    // Keep the first primary read on its ordinary held/unavailable path, then
    // fail the unguarded collection read. This records the intended outer fatal
    // even when it is null/undefined, without changing inner hold semantics.
    fetchPage: async () => { fetches++; if (fetches === 1) throw unavailablePrimary; throw failure },
    onAudit: async (...args) => {
      audits++; order.push('audit'); assert.equal(args.length, 1)
      assert.equal(args[0].sourceScopeComplete, false); assert.equal(args[0].lifecycleCleanupAllowed, false)
      assert.equal(args[0].opening, undefined); assert.equal(args[0].closing, undefined)
      assert.deepEqual(args[0].observations, [])
      return callbacks.onAudit?.(...args)
    },
    onRecords: async (...args) => {
      records++; order.push('records'); assert.equal(args.length, 1); assert.deepEqual(args[0], [])
      return callbacks.onRecords?.(...args)
    }, ...(callbacks.signal ? { signal: callbacks.signal } : {}) }))
  assert.equal(fetches, 2); assert.equal(nameReads, 1)
  return { result, order, audits, records }
}
for (const api of apis) for (const [index, [label, primary]] of primaries.entries()) {
  test(api.name + ' recorded ' + label + ' collection failure rejects exactly after both successful diagnostics', async () => {
    const observed = await run(api, primary)
    exact(observed.result, primary); assert.deepEqual(observed.order, ['audit', 'records']); assert.equal(observed.audits, 1); assert.equal(observed.records, 1)
  })
  for (const stage of ['onAudit', 'onRecords']) {
    test(api.name + ' ordinary ' + stage + ' error retains precedence over recorded ' + label + ' collection failure', async () => {
      const observerError = Object.freeze(Error('Authored ordinary observer failure'))
      const observed = await run(api, primary, { [stage]: async () => { await Promise.resolve(); throw observerError } })
      exact(observed.result, observerError); assert.deepEqual(observed.order, stage === 'onAudit' ? ['audit'] : ['audit', 'records'])
      assert.equal(observed.audits, 1); assert.equal(observed.records, stage === 'onAudit' ? 0 : 1)
    })
    for (const behavior of ['abort-return', 'abort-throw']) {
      test(api.name + ' ' + stage + ' ' + behavior + ' caller wins recorded ' + label + ' collection failure', async () => {
        const caller = new AbortController(), reason = callerReasons[index], replacement = Object.freeze(Error('Authored observer replacement'))
        const observed = await run(api, primary, { signal: caller.signal, [stage]: async () => {
          await Promise.resolve(); caller.abort(reason); if (behavior === 'abort-throw') throw replacement
        } })
        exact(observed.result, reason); assert.deepEqual(observed.order, stage === 'onAudit' ? ['audit'] : ['audit', 'records'])
        assert.equal(observed.audits, 1); assert.equal(observed.records, stage === 'onAudit' ? 0 : 1)
      })
    }
  }
}

