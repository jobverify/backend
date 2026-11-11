// Actual retained helper with authored unavailable collaborators only.
// No native response, job, inventory, country or criteria facts are supplied.
import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { runNativeKeka } from '../scraper/acciojob/nativeKeka.js'
import accio from '../scraper/acciojob/nativeConfig.js'
import open from '../scraper/openfinancialtechnologies/nativeConfig.js'
const now = '2026-11-11T06:00:00.000Z'
const base = { now, requestIntervalMs: 0, timeoutMs: 1000 }
const reasons = [['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Error('Authored caller reason'))], ['default', () => AbortSignal.abort().reason]]
const snapshot = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const timeouts = () => process.getActiveResourcesInfo().filter(type => type === 'Timeout').length
async function failureOf(promise) {
  let failed = false, reason
  try { await promise } catch (error) { failed = true; reason = error }
  assert.equal(failed, true)
  return reason
}
async function clean(caller, reason, descriptors, count) {
  await nextTurn()
  assert.deepEqual(snapshot(reason), descriptors)
  assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  assert.ok(timeouts() <= count)
}
for (const config of [accio, open]) {
  for (const [kind, makeReason] of reasons) {
    for (const stage of ['pre-clock', 'clock-throw', 'clock-invalid', 'clock-getter-return', 'clock-getter-throw',
      'classifier-getter-return', 'classifier-getter-throw', 'classifier-coercion']) {
      test(`${config.source} ${stage} keeps unchanged ${kind} and stops later admission`, { timeout: 3000 }, async () => {
        const caller = new AbortController(), reason = makeReason(), descriptors = snapshot(reason), count = timeouts()
        const secondary = Object.freeze(Error('Authored secondary callback failure'))
        let fetches = 0, clocks = 0, nowReads = 0, classifierReads = 0
        const options = { ...base, signal: caller.signal, fetchImpl: () => {
          fetches++
          const primary = Error('Authored diagnostic primary')
          Object.defineProperty(primary, 'message', { configurable: true, get() {
            classifierReads++
            if (stage === 'classifier-coercion') return { toString() { caller.abort(reason); return 'ECONNRESET' } }
            caller.abort(reason)
            if (stage === 'classifier-getter-throw') throw secondary
            return 'ECONNRESET'
          } })
          throw primary
        } }
        if (stage.startsWith('clock-') || stage === 'pre-clock') options.now = () => {
          clocks++
          if (stage !== 'pre-clock') caller.abort(reason)
          if (stage === 'clock-invalid') return 'invalid-clock'
          throw secondary
        }
        if (stage.startsWith('clock-getter')) Object.defineProperty(options, 'now', { configurable: true, get() {
          nowReads++; caller.abort(reason)
          if (stage === 'clock-getter-throw') throw secondary
          return () => { clocks++; return now }
        } })
        if (stage === 'pre-clock') caller.abort(reason)
        const observed = await failureOf(runNativeKeka(config, options))
        assert.ok(Object.is(observed, reason))
        assert.equal(fetches, stage.startsWith('classifier') ? 1 : 0)
        if (stage === 'pre-clock' || stage.startsWith('clock-getter')) assert.equal(clocks, 0)
        if (stage.startsWith('clock-getter')) assert.equal(nowReads, 1)
        if (stage.startsWith('classifier')) assert.equal(classifierReads, 1)
        await clean(caller, reason, descriptors, count)
      })
    }
  }

  test(`${config.source} diagnostic getter cannot annotate its new caller alias`, { timeout: 3000 }, async () => {
    const caller = new AbortController(), primary = Error('Authored caller/primary alias'), count = timeouts()
    Object.defineProperty(primary, 'message', { configurable: true, get() { caller.abort(primary); return 'ECONNRESET' } })
    const descriptors = snapshot(primary)
    assert.equal(await failureOf(runNativeKeka(config, { ...base, signal: caller.signal, fetchImpl: () => { throw primary } })), primary)
    await clean(caller, primary, descriptors, count)
  })

  test(`${config.source} retains ordinary clock failure identity`, { timeout: 3000 }, async () => {
    const primary = Object.freeze(Error('Authored uncancelled clock failure'))
    let fetches = 0
    assert.equal(await failureOf(runNativeKeka(config, { ...base, now() { throw primary }, fetchImpl() { fetches++ } })), primary)
    assert.equal(fetches, 0)
  })

  for (const type of ['function', 'value']) {
    test(`${config.source} retains normal clock ${type} getter reads and receiver`, { timeout: 3000 }, async () => {
      const primary = Object.freeze(Error('Authored unavailable transport'))
      let reads = 0, clocks = 0
      const options = { ...base, fetchImpl() { throw primary } }
      Object.defineProperty(options, 'now', { get() {
        assert.equal(this, options); reads++
        return type === 'value' ? now : function() { assert.equal(this, options); clocks++; return now }
      } })
      assert.equal(await failureOf(runNativeKeka(config, options)), primary)
      assert.equal(reads, 2)
      assert.equal(clocks, type === 'function' ? 1 : 0)
    })
  }

  for (const throwing of [false, true]) {
    test(`${config.source} keeps uncancelled classifier getter ${throwing ? 'throw' : 'classification'}`, { timeout: 3000 }, async () => {
      const primary = Error('Authored primary'), secondary = Object.freeze(Error('Authored classifier exception'))
      let reads = 0
      Object.defineProperty(primary, 'message', { get() { reads++; if (throwing) throw secondary; return 'ECONNRESET' } })
      assert.equal(await failureOf(runNativeKeka(config, { ...base, fetchImpl() { throw primary } })), throwing ? secondary : primary)
      assert.equal(reads, 1)
      if (!throwing) {
        assert.equal(primary.abortRetries, true); assert.equal(primary.softFailure, true)
        assert.equal(primary.upstreamOutage, true); assert.equal(primary.failureKind, 'network_or_timeout')
      }
    })
  }
}
