import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { registerHooks } from 'node:module'
import { runNativeAeries } from '../scraper/aeriestechnology/nativeRun.js'
import { runNativeEInfochips } from '../scraper/einfochips.workday/nativeRun.js'
import { runNativeFinacus } from '../scraper/finacussolutions/nativeRun.js'
import { runNativeExperion } from '../scraper/experiontechnologies/nativeRun.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { API, BOARD } from '../scraper/einfochips.workday/nativeGuard.js'

// Early controls use actual exported source readers and actual contracts.
// No native fixture is fabricated. Finacus nativeRun is the archival API;
// its current nativeCurrent/default public route remains outside this repair.
const sources = { aeries: runNativeAeries, einfochips: runNativeEInfochips, 'finacus-archival': runNativeFinacus, experion: runNativeExperion }
const now = '2026-11-11T00:00:00.000Z'
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network']
const reasonFor = kind => kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'empty' ? ''
  : kind === 'default' ? AbortSignal.abort().reason : kind === 'frozen' ? Object.freeze(Error('Authored frozen caller'))
    : kind === 'network' ? Object.assign(Error('Authored network caller'), { code: 'ECONNRESET' })
      : Object.freeze(Object.assign(Error('Authored frozen network caller'), { code: 'ECONNRESET' }))
const descriptors = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const reflect = promise => Promise.resolve(promise).then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason), 'Exact opaque reason must survive') }
const turn = () => new Promise(resolve => setImmediate(resolve))
const clean = signals => { for (const signal of new Set(signals)) assert.equal(getEventListeners(signal, 'abort').length, 0) }

for (const [source, run] of Object.entries(sources)) for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`${source} actual text getter abort ${kind} then ${disposition} admits no body method`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), signals = []
  const replacement = Object.freeze(Error('Authored getter replacement'))
  let fetches = 0, getters = 0, bodies = 0
  const result = await reflect(run({ now, signal: caller.signal, fetchImpl(url, init) {
    fetches++; signals.push(init.signal)
    return { status: 200, url, get text() {
      getters++; caller.abort(reason); if (disposition === 'throw') throw replacement
      return () => { bodies++; return 'Authored unreachable body, not native evidence' }
    } }
  } }))
  exact(result, reason); await turn()
  assert.equal(fetches, 1); assert.equal(getters, 1); assert.equal(bodies, 0)
  assert.deepEqual(descriptors(reason), before); clean([caller.signal, ...signals])
})

const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary getter primary'))]]
for (const [source, run] of Object.entries(sources)) for (const [name, primary] of primaries) test(`${source} ordinary text getter ${name} primary remains exact`, async () => {
  const signals = []; let getters = 0, fetches = 0
  exact(await reflect(run({ now, fetchImpl(url, init) { fetches++; signals.push(init.signal); return { status: 200, url, get text() { getters++; throw primary } } } })), primary)
  assert.equal(fetches, 1); assert.equal(getters, 1); clean(signals)
})

for (const [source, run] of Object.entries(sources)) for (const mode of ['value', 'promise', 'thenable']) test(`${source} normal text ${mode} preserves receiver, one read and assimilation`, async () => {
  const primary = Object.freeze(Error('Authored unavailable second transport')), signals = []
  let fetches = 0, getters = 0, bodies = 0, thens = 0
  const result = await reflect(run({ now, fetchImpl(url, init) {
    fetches++; signals.push(init.signal); if (fetches === 2) throw primary
    const response = { status: 200, url, get text() {
      getters++
      return function () {
        assert.equal(this, response); bodies++
        const value = 'Authored first shell, never native-qualified'
        if (mode === 'promise') return Promise.resolve(value)
        if (mode === 'thenable') { const thenable = { then(resolve) { assert.equal(this, thenable); thens++; resolve(value) } }; return thenable }
        return value
      }
    } }
    return response
  } }))
  exact(result, primary); assert.equal(fetches, 2); assert.equal(getters, 1); assert.equal(bodies, 1); assert.equal(thens, mode === 'thenable' ? 1 : 0); clean(signals)
})

for (const [source, run] of Object.entries(sources)) for (const kind of kinds) test(`${source} already-created rejecting text result remains owned after ${kind} abort`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), signals = []
  let getters = 0, bodies = 0
  const result = await reflect(run({ now, signal: caller.signal, fetchImpl(url, init) {
    signals.push(init.signal)
    const response = { status: 200, url, get text() {
      getters++
      return function () { assert.equal(this, response); bodies++; caller.abort(reason); return Promise.reject(Object.freeze(Error('Authored late text rejection'))) }
    } }
    return response
  } }))
  exact(result, reason); await turn(); await turn()
  assert.equal(getters, 1); assert.equal(bodies, 1); assert.deepEqual(descriptors(reason), before); clean([caller.signal, ...signals])
})

for (const [source, run] of Object.entries(sources)) for (const method of [undefined, null, 0, {}]) test(`${source} invalid text method ${String(method)} remains TypeError`, async () => {
  let reads = 0
  const result = await reflect(run({ now, fetchImpl(url) { return { status: 200, url, get text() { reads++; return method } } } }))
  assert.equal(result.ok, false); assert.ok(result.reason instanceof TypeError); assert.equal(reads, 1)
})

for (const kind of kinds) for (const disposition of ['return', 'throw']) test(`einfochips actual Arrow text getter abort ${kind} then ${disposition} admits no body`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), signals = []
  let fetches = 0, getters = 0, bodies = 0
  const result = await reflect(runNativeEInfochips({ now, signal: caller.signal, fetchImpl(url, init) {
    fetches++; signals.push(init.signal)
    if (fetches === 1) return { status: 200, url, text: () => 'Authored unavailable corporate shell' }
    return { status: 200, url, get text() {
      getters++; caller.abort(reason); if (disposition === 'throw') throw Error('Authored Arrow getter replacement')
      return () => { bodies++; return 'Authored unreachable Arrow body' }
    } }
  } }))
  exact(result, reason); await turn()
  assert.equal(fetches, 2); assert.equal(getters, 1); assert.equal(bodies, 0); assert.deepEqual(descriptors(reason), before); clean([caller.signal, ...signals])
})

// Only this query-bound module's two native guard functions are replaced by an
// explicitly authored lifecycle model. Real constants, envelope, identity,
// request code, closing logic and source bytes are retained. Nothing below
// qualifies native inventory, country, employer criteria or source coverage.
const modelURL = new URL('../scraper/einfochips.workday/nativeRun.js?authored-body-admission-json', import.meta.url).href
const guardURL = new URL('../scraper/einfochips.workday/nativeGuard.js', import.meta.url).href
const guardModel = 'export {CORPORATE,ARROW,API,BOARD,INDIA} from ' + JSON.stringify(guardURL) + ';'
  + 'export const verifyCurrentHandoff=(...args)=>globalThis.__bodyAdmissionProtocol("handoff",args);'
  + 'export const validateNativeDetail=(...args)=>globalThis.__bodyAdmissionProtocol("detail",args);'
const modelGuardURL = 'data:text/javascript,' + encodeURIComponent(guardModel)
registerHooks({ resolve(specifier, context, next) { return specifier === './nativeGuard.js' && context.parentURL === modelURL ? { url: modelGuardURL, shortCircuit: true } : next(specifier, context) } })
const { runNativeEInfochips: runJsonModel } = await import(modelURL)
let current
globalThis.__bodyAdmissionProtocol = (name, args) => {
  assert.ok(current, 'Authored JSON protocol must be active')
  if (name === 'handoff') { assert.equal(args.length, 2); return }
  if (name === 'detail') { current.validations++; assert.equal(args[0].authored, 'detail'); return { ...args[1], protocolOnly: true, country: null, sourceDetailComplete: false } }
  throw Error('UNEXPECTED_BODY_ADMISSION_PROTOCOL_INTERFACE: ' + name)
}
const row = { title: 'Authored Role', externalPath: '/job/Authored/Role_R900001', bulletFields: ['R900001'] }
const mapped = { title: row.title, requisitionId: 'R900001', link: BOARD + row.externalPath, country: null, sourceDetailComplete: false, protocolOnly: true }
const makeState = (target, mode, reason, primary) => ({ target, mode, reason, primary, caller: new AbortController(), signals: [], fetches: [], listingReads: 0, jsonReads: [], jsonCalls: [], validations: 0 })
const optionsFor = state => ({ now, signal: state.caller.signal,
  runWorkday: async () => attachInventoryEvidence([{ ...mapped }], { status: 'complete-inventory', firstParty: true, listingComplete: true, reportedTotal: 1, protocolOnly: true }),
  fetchImpl(url, init) {
    state.fetches.push(url); state.signals.push(init.signal)
    const listing = url === API
    if (!listing && url !== API.slice(0, -5) + row.externalPath) return { status: 200, url, text: () => 'Authored handoff shell, not native evidence' }
    if (listing) state.listingReads++
    const phase = listing ? state.listingReads === 1 ? 'opening' : 'closing' : 'detail'
    const response = { status: 200, url, get json() {
      state.jsonReads.push(phase)
      if (phase === state.target && state.mode === 'ordinary-throw') throw state.primary
      if (phase === state.target && ['getter-return', 'getter-throw'].includes(state.mode)) {
        state.caller.abort(state.reason); if (state.mode === 'getter-throw') throw Error('Authored JSON getter replacement')
      }
      return function () {
        assert.equal(this, response); state.jsonCalls.push(phase)
        if (phase === state.target && state.mode === 'method-late-reject') { state.caller.abort(state.reason); return Promise.reject(Error('Authored late JSON rejection')) }
        const value = listing ? { total: 1, jobPostings: [structuredClone(row)] } : { authored: 'detail' }
        return { then(resolve) { resolve(value) } }
      }
    } }
    return response
  },
})
for (const target of ['opening', 'detail', 'closing']) for (const kind of kinds) for (const mode of ['getter-return', 'getter-throw']) test(`authored einfochips ${target} JSON ${mode} ${kind} admits no method`, async () => {
  const reason = reasonFor(kind), before = descriptors(reason)
  current = makeState(target, mode, reason)
  const state = current, result = await reflect(runJsonModel(optionsFor(state)))
  exact(result, reason); await turn()
  assert.equal(state.jsonReads.filter(value => value === target).length, 1)
  assert.equal(state.jsonCalls.filter(value => value === target).length, 0)
  assert.equal(state.fetches.length, target === 'opening' ? 3 : target === 'detail' ? 4 : 5)
  assert.deepEqual(descriptors(reason), before); clean([state.caller.signal, ...state.signals])
})
for (const target of ['opening', 'detail', 'closing']) for (const kind of kinds) test(`authored einfochips ${target} rejecting JSON result is owned after ${kind} abort`, async () => {
  const reason = reasonFor(kind), before = descriptors(reason)
  current = makeState(target, 'method-late-reject', reason)
  const state = current, result = await reflect(runJsonModel(optionsFor(state)))
  exact(result, reason); await turn(); await turn()
  assert.equal(state.jsonReads.filter(value => value === target).length, 1); assert.equal(state.jsonCalls.filter(value => value === target).length, 1)
  assert.deepEqual(descriptors(reason), before); clean([state.caller.signal, ...state.signals])
})
for (const target of ['opening', 'detail', 'closing']) for (const [name, primary] of primaries) test(`authored einfochips ${target} ordinary JSON getter ${name} remains exact`, async () => {
  current = makeState(target, 'ordinary-throw', undefined, primary)
  const state = current
  exact(await reflect(runJsonModel(optionsFor(state))), primary)
  assert.equal(state.jsonCalls.filter(value => value === target).length, 0); clean([state.caller.signal, ...state.signals])
})
test('authored einfochips normal JSON methods retain one read, receiver, thenables and closing hold', async () => {
  current = makeState(null, 'normal')
  const state = current, jobs = await runJsonModel(optionsFor(state)), evidence = readInventoryEvidence(jobs)
  assert.deepEqual(state.jsonReads, ['opening', 'detail', 'closing']); assert.deepEqual(state.jsonCalls, state.jsonReads)
  assert.equal(state.validations, 1); assert.equal(jobs.length, 1); assert.equal(jobs[0].protocolOnly, true)
  assert.equal(jobs[0].country, null); assert.equal(evidence.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false); clean(state.signals)
})
