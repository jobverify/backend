import assert from 'node:assert/strict'
import test from 'node:test'

import { run, WORKDAY_BOARD_URL } from './script.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentCareers = `<title>Careers | Rocket Software</title><p>Rocket Software</p><a href="${WORKDAY_BOARD_URL}">View current openings</a>`

test('Rocket country-proof work stops before the official request when the source is already cancelled', async () => {
  const controller = new AbortController(), reason = new Error('cancelled scope validation')
  controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal,
    fetchText: async () => { requests++; return currentCareers },
    runWorkday: async () => { requests++; return [] },
  }), error => error === reason)
  assert.equal(requests, 0)
})

test('Rocket forwards the same caller signal to preflight and native country verification', async () => {
  const controller = new AbortController()
  let preflightSignal, nativeSignal
  await run({ signal: controller.signal,
    fetchText: async (_url, options) => { preflightSignal = options?.signal; return currentCareers },
    runWorkday: async options => { nativeSignal = options.signal; return [] },
  })
  assert.equal(preflightSignal, controller.signal)
  assert.equal(nativeSignal, controller.signal)
})

test('Rocket cancellation cannot be mistaken for a tolerated public gate', async () => {
  const controller = new AbortController(), reason = new Error('HTTP 403 caller cancellation')
  let nativeStarted = false
  await assert.rejects(run({ signal: controller.signal,
    fetchText: async () => { controller.abort(reason); throw reason },
    runWorkday: async () => { nativeStarted = true; return [] },
  }), error => error === reason)
  assert.equal(nativeStarted, false)
})

test('Rocket preserves the returned native inventory and country-proof receipts while decorating jobs', async () => {
  const jobs = attachInventoryEvidence([{ title: 'Engineer', link: WORKDAY_BOARD_URL + '/job/Hyderabad/Engineer_R1' }], {
    status: 'coverage-gap', surface: WORKDAY_BOARD_URL, firstParty: true, listingComplete: false,
    reportedTotal: null, reason: 'native-country-scope-unresolved',
  })
  const symbol = Symbol.for('jobverify.workday.country-inventory-proof'), proof = { scope: 'complete-board-country-proof', unresolvedRoles: [{ url: 'native-unknown-role' }] }
  Object.defineProperty(jobs, symbol, { value: proof })
  const result = await run({ fetchText: async () => currentCareers, runWorkday: async () => jobs })
  assert.deepEqual(readInventoryEvidence(result), readInventoryEvidence(jobs))
  assert.deepEqual(result[symbol], proof)
  assert.equal(result[0].source, 'rocketsoftware')
  assert.equal(result[0].applyUrl, jobs[0].link)
})

test('Rocket rejects caller cancellation after the native response rather than returning a successful array', async () => {
  const controller = new AbortController(), reason = new Error('native scope cancelled at completion')
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => currentCareers,
    runWorkday: async () => { controller.abort(reason); return [] },
  }), error => error === reason)
})

test('a blocked current Rocket handoff prevents every native empty-inventory request', async () => {
  const jobs = attachInventoryEvidence([], { status: 'verified-empty', surface: WORKDAY_BOARD_URL,
    firstParty: true, listingComplete: true, pagesFetched: 1, verifiedAt: new Date().toISOString(),
    reportedTotal: 0, indiaFacetCount: 0, reason: 'native-facet-empty' })
  const empty = Symbol.for('jobverify.workday.authoritative-empty')
  Object.defineProperty(jobs, empty, { value: true })
  let nativeCalls=0
  await assert.rejects(run({fetchText:async()=>{throw Error('HTTP 403 current careers unavailable')},
    runWorkday:async()=>{nativeCalls++;return jobs}}),/HTTP 403/)
  assert.equal(nativeCalls,0)
})

test('a blocked Rocket handoff cannot publish jobs from a stored account', async () => {
  const native = { title: 'Engineer', link: WORKDAY_BOARD_URL + '/job/Hyderabad/Engineer_R1',
    sourceDescription: 'Original native engineering responsibilities remain available.' }
  const jobs = attachInventoryEvidence([native], { status: 'complete-inventory', surface: WORKDAY_BOARD_URL,
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 1, indiaFacetCount: 1,
    verifiedAt: new Date().toISOString() })
  let nativeCalls=0
  await assert.rejects(run({fetchText:async()=>{throw Error('HTTP 403 current careers unavailable')},
    runWorkday:async()=>{nativeCalls++;return jobs}}),/HTTP 403/)
  assert.equal(nativeCalls,0)
})
