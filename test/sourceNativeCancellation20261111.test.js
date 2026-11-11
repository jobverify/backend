import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Child readers use actual exports under strict read-only Node permissions.
// Deep stages alone use explicitly authored inert contract-boundary protocols.
// These models are not employer responses, native captures or country/criteria
// evidence. No missing replay fixture is reconstructed or replaced.
async function scenario({ source, mode, route }) {
  const { default: assert } = await import('node:assert/strict')
  const { registerHooks, syncBuiltinESMExports } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  const { getEventListeners } = await import('node:events')
  let networkAttempts = 0
  const deny = () => { networkAttempts++; throw Error('Source cancellation controls forbid actual network') }
  globalThis.fetch = deny
  for (const name of ['node:http', 'node:https']) { const module = (await import(name)).default; module.get = deny; module.request = deny }
  ;(await import('node:http2')).default.connect = deny
  const net = (await import('node:net')).default
  net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny
  ;(await import('node:tls')).default.connect = deny
  ;(await import('node:dgram')).default.createSocket = deny
  syncBuiltinESMExports()
  const permissions = Object.fromEntries(['addons', 'worker', 'child'].map(name => [name, process.permission.has(name)]))
  assert.deepEqual(permissions, { addons: false, worker: false, child: false })
  const configs = {
    aeries: { directory: 'aeriestechnology', exported: 'runNativeAeries', contract: 'nativeContract.js',
      constants: ['CORPORATE', 'BOARD', 'API', 'CONTROLLER', 'MAIN', 'TEMPLATE', 'nativeRoleUrl'],
      functions: ['verifyAeriesBinding', 'readAeriesRows', 'validateAeriesDetail'] },
    einfochips: { directory: 'einfochips.workday', exported: 'runNativeEInfochips', contract: 'nativeGuard.js',
      constants: ['CORPORATE', 'ARROW', 'API', 'BOARD', 'INDIA'], functions: ['verifyCurrentHandoff', 'validateNativeDetail'] },
    finacus: { directory: 'finacussolutions', exported: 'runNativeFinacus', contract: 'nativeContract.js',
      constants: ['HOME', 'CAREERS', 'detailUrl'], functions: ['parseFinacusSurface', 'validateFinacusClients', 'validateFinacusDetail'] },
    experion: { directory: 'experiontechnologies', exported: 'runNativeExperion', contract: 'nativeContract.js',
      constants: ['HOME', 'CAREERS', 'CLIENT'], functions: ['verifyExperionInventory', 'validateExperionDetail'] },
  }
  const config = configs[source], root = process.cwd() + '/scraper/' + config.directory + '/'
  let current
  if (mode === 'model') {
    const contractURL = pathToFileURL(root + config.contract).href
    const moduleText = 'export {' + config.constants.join(',') + '} from ' + JSON.stringify(contractURL) + ';'
      + config.functions.map(name => 'export const ' + name + '=(...args)=>globalThis.__sourceNativeProtocol(' + JSON.stringify(name) + ',args);').join('')
    const modelURL = 'data:text/javascript,' + encodeURIComponent(moduleText)
    registerHooks({ resolve(specifier, context, next) {
      return specifier === './' + config.contract && context.parentURL === pathToFileURL(root + 'nativeRun.js').href
        ? { url: modelURL, shortCircuit: true } : next(specifier, context)
    } })
  }
  const nativeModule = await import(pathToFileURL(root + (route === 'current-native' ? 'nativeCurrent.js' : 'nativeRun.js')))
  const publicModule = route === 'public' || route === 'current-public' ? await import(pathToFileURL(root + 'script.js')) : null
  const run = publicModule?.run ?? nativeModule[config.exported]
  if (route === 'public') assert.equal(run, nativeModule[config.exported], 'Current public run must actually alias the assigned export')
  const { attachInventoryEvidence } = await import(pathToFileURL(process.cwd() + '/scraper-support/utils/inventoryEvidence.js'))
  const realContract = await import(pathToFileURL(root + config.contract))
  const nativeTimeout = globalThis.setTimeout, nativeClearTimeout = globalThis.clearTimeout, timers = new Set()
  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    let id
    id = nativeTimeout(() => { timers.delete(id); callback(...args) }, milliseconds)
    timers.add(id); return id
  }
  globalThis.clearTimeout = id => { timers.delete(id); return nativeClearTimeout(id) }
  const now = '2026-11-11T00:00:00.000Z', kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network']
  const reasonFor = kind => {
    if (kind === 'null') return null
    if (kind === 'false') return false
    if (kind === 'zero') return 0
    if (kind === 'empty') return ''
    if (kind === 'default') return AbortSignal.abort().reason
    if (kind === 'frozen') return Object.freeze(Error('Authored frozen caller'))
    const value = Object.assign(Error('Authored network-shaped caller'), { code: 'ECONNRESET', authored: true })
    return kind === 'frozen-network' ? Object.freeze(value) : value
  }
  const descriptors = value => value !== null && (typeof value === 'object' || typeof value === 'function') ? Object.getOwnPropertyDescriptors(value) : null
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
  const reflect = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
  const turn = () => new Promise(resolve => setImmediate(resolve))
  const bounded = async promise => {
    let timer
    try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve({ pending: true }), 150) })]) }
    finally { clearTimeout(timer) }
  }
  const exact = (result, reason) => { assert.equal(result.pending, undefined); assert.equal(result.ok, false); assert.equal(result.reason, reason) }
  const rows = []
  async function control(label, kind, work) {
    const reason = reasonFor(kind), before = descriptors(reason)
    let failed = false, failure
    try { await work(reason); assert.deepEqual(descriptors(reason), before); assert.equal(timers.size, 0, 'Owned source/watchdog timers must be cleared') }
    catch (error) { failed = true; failure = error }
    rows.push({ label, kind, pass: !failed, ...(failed ? { error: String(failure?.message ?? failure) } : {}) })
  }
  const verifyListeners = signals => { for (const signal of new Set(signals)) assert.equal(getEventListeners(signal, 'abort').length, 0) }
  if (mode === 'actual') {
    const stages = route.startsWith('current-') ? ['pre-aborted'] : [
      'pre-aborted', 'queued-factory', 'transport-pending', 'transport-abort-throw', 'body-pending',
      'body-abort-return', 'body-abort-throw', 'status-abort-return', 'clock-abort-throw',
    ]
    for (const stage of stages) for (const kind of kinds) await control(stage, kind, async reason => {
      const caller = new AbortController(), entered = deferred(), release = deferred(), replacement = Object.freeze(Error('Authored collaborator replacement'))
      let fetches = 0, bodies = 0, clocks = 0, releaseUsed = false
      const signals = [], options = { signal: caller.signal, now: () => {
        clocks++
        if (stage === 'clock-abort-throw') { caller.abort(reason); throw replacement }
        return now
      }, fetchImpl: (url, init) => {
        fetches++; signals.push(init.signal)
        if (stage === 'transport-abort-throw') { caller.abort(reason); throw replacement }
        if (stage === 'transport-pending' || stage === 'queued-factory') { releaseUsed = true; entered.resolve(); return release.promise }
        const response = { url, status: 200, text: () => {
          bodies++
          if (stage === 'body-pending') { releaseUsed = true; entered.resolve(); return release.promise }
          caller.abort(reason); if (stage === 'body-abort-throw') throw replacement
          return Promise.resolve('Authored body sentinel; never native proof')
        } }
        if (stage === 'status-abort-return') Object.defineProperty(response, 'status', { get() { caller.abort(reason); return 503 } })
        return response
      } }
      if (stage === 'pre-aborted') caller.abort(reason)
      const pending = reflect(run(options))
      if (stage === 'queued-factory') caller.abort(reason)
      if (stage === 'transport-pending' || stage === 'body-pending') { await entered.promise; caller.abort(reason) }
      const early = await bounded(pending)
      if (stage === 'transport-pending' || stage === 'body-pending' || stage === 'queued-factory') {
        if (releaseUsed) release.reject(Error('Authored late collaborator rejection'))
        else release.resolve()
      }
      await pending; await turn(); await turn()
      exact(early, reason)
      if (stage === 'pre-aborted') { assert.equal(clocks, 0); assert.equal(fetches, 0) }
      if (stage === 'queued-factory') assert.equal(fetches, 0)
      if (stage === 'clock-abort-throw') assert.equal(fetches, 0)
      if (stage === 'transport-pending' || stage === 'transport-abort-throw' || stage === 'status-abort-return') assert.equal(bodies, 0)
      assert.ok(fetches <= 1); verifyListeners(signals)
    })
    if (!route.startsWith('current-')) {
      await control('ordinary clock error identity', 'frozen', async () => {
        const primary = Object.freeze(Error('Authored ordinary clock error')); let calls = 0
        exact(await reflect(run({ now: () => { throw primary }, fetchImpl: () => { calls++; throw Error('No transport') } })), primary); assert.equal(calls, 0)
      })
      await control('ordinary first transport error identity', 'frozen', async () => {
        const primary = Object.freeze(Error('Authored ordinary transport error'))
        exact(await reflect(run({ now, fetchImpl: () => { throw primary } })), primary)
      })
      await control('ordinary first body error identity', 'frozen', async () => {
        const primary = Object.freeze(Error('Authored ordinary body error'))
        exact(await reflect(run({ now, fetchImpl: url => ({ status: 200, url, text: () => { throw primary } }) })), primary)
      })
      await control('owned source deadline remains original error', 'frozen', async () => {
        const result = await bounded(reflect(run({ now, timeoutMs: 15, fetchImpl: () => new Promise(() => {}) })))
        assert.equal(result.pending, undefined); assert.equal(result.ok, false); assert.match(result.reason.message, /source deadline/i)
      })
      await control('ordinary HTTP failure remains failure', 'frozen', async () => {
        const result = await reflect(run({ now, fetchImpl: url => ({ status: 503, url }) }))
        assert.equal(result.ok, false); assert.match(result.reason.message, /HTTP status/i)
      })
    }
  } else {
    const ids = ['900001', '900002', '900003']
    const rawRows = ids.map((id, index) => ({ REF_REQ_ID: Number(id), JOB_TITLE: 'Authored Role ' + index,
      jobId: 'authored-' + id, title: 'Authored Role ' + index, sourceUrl: 'https://experionglobal.com/jobs/authored-' + id + '/',
      nativeRemoteScopeUnknown: false, externalPath: '/job/Authored/Role_R' + id, bulletFields: ['R' + id] }))
    const pageRows = rawRows.map(row => ({ title: row.title, externalPath: row.externalPath, bulletFields: row.bulletFields }))
    const sharedJobs = rawRows.map(row => ({ title: row.title, requisitionId: row.bulletFields[0], link: realContract.BOARD + row.externalPath, protocolOnly: true }))
    const listingURL = realContract.API ?? realContract.CAREERS
    const detailURLs = source === 'aeries' ? rawRows.map(row => realContract.nativeRoleUrl(row))
      : source === 'einfochips' ? rawRows.map(row => realContract.API.slice(0, -5) + row.externalPath)
      : source === 'finacus' ? ids.map(id => realContract.detailUrl(id)) : rawRows.map(row => row.sourceUrl)
    const syntheticBody = 'Authored lifecycle-only entity; no employer source content.'
    globalThis.__sourceNativeProtocol = (name, args) => {
      assert.ok(current, 'No active authored protocol')
      if (name === 'verifyAeriesBinding') { assert.equal(args.length, 5); assert.ok(args.every(value => typeof value === 'string')); return }
      if (name === 'verifyCurrentHandoff') { assert.equal(args.length, 2); return }
      if (name === 'validateFinacusClients') { assert.equal(args.length, 3); return }
      if (name === 'readAeriesRows' || name === 'verifyExperionInventory') {
        if (name === 'readAeriesRows') assert.equal(args[0].authored, 'listing')
        const result = structuredClone(rawRows)
        if (current.stage === 'normal-drift' && ++current.inventoryReads > 1) result[0].title = 'Authored closing drift'
        return result
      }
      if (name === 'parseFinacusSurface') {
        assert.equal(args.length, 2)
        const cards = ids.map((id, index) => ({ jobId: id, title: 'Authored Role ' + index, nativeApplicationPosition: 'Authored Role ' + index }))
        if (current.stage === 'normal-drift' && ++current.inventoryReads > 1) cards[0].title = 'Authored closing drift'
        return { cards, ajaxClient: realContract.HOME + 'authored-ajax.js', mainClient: realContract.HOME + 'authored-main.js', loaderClient: realContract.HOME + 'authored-loader.js' }
      }
      if (['validateAeriesDetail', 'validateNativeDetail', 'validateFinacusDetail', 'validateExperionDetail'].includes(name)) {
        current.validations++
        if (current.stage === 'ordinary-fanout-failure' && current.validations === 1) throw current.primary
        if (current.stage === 'ordinary-primary') throw current.primary
        const index = source === 'einfochips' ? sharedJobs.findIndex(job => job.requisitionId === args[1].requisitionId)
          : source === 'aeries' ? ids.indexOf(String(args[1].REF_REQ_ID))
          : source === 'finacus' ? ids.indexOf(args[1].jobId) : rawRows.findIndex(row => row.jobId === args[1].jobId)
        assert.ok(index >= 0, 'Unexpected authored detail identity')
        return { protocolOnly: true, jobId: rawRows[index].jobId, nativeDisplayJobId: 'authored-display-' + index,
          sourceDetailComplete: false, country: null, lifecycleCleanupAllowed: false, sourceScopeComplete: false, jobDescription: 'Authored lifecycle sentinel' }
      }
      throw Error('UNEXPECTED_AUTHORED_NATIVE_PROTOCOL_INTERFACE: ' + name)
    }
    const makeState = (stage, reason) => ({ stage, reason, caller: new AbortController(), calls: [], signals: [], listingReads: 0,
      inventoryReads: 0, validations: 0, detailStarts: [], bodyStarts: 0, entered: deferred(), releases: [], primary: Object.freeze(Error('Authored ordinary model failure')) })
    const responseAt = (url, state) => {
      const listing = url === listingURL
      const body = () => {
        state.bodyStarts++
        if ((state.stage === 'closing-return' || state.stage === 'closing-throw') && listing && state.listingReads === 2
          || state.stage === 'listing-throw' && listing) {
          state.caller.abort(state.reason); if (state.stage.endsWith('throw')) throw Error('Authored late listing/body replacement')
        }
        if (source === 'aeries' && listing) return state.stage === 'ordinary-listing-syntax' ? '{ Authored malformed listing' : JSON.stringify({ authored: 'listing' })
        return syntheticBody
      }
      const json = () => {
        body()
        if (listing) {
          const result = { total: pageRows.length, jobPostings: structuredClone(pageRows) }
          if (state.stage === 'normal-drift' && state.listingReads === 2) result.jobPostings[0].title = 'Authored closing drift'
          return result
        }
        return { authored: 'detail' }
      }
      const result = { status: 200, url, text: async () => body(), json: async () => json() }
      if (state.stage === 'listing-status-abort' && listing) Object.defineProperty(result, 'status', { get() { state.caller.abort(state.reason); return 503 } })
      return result
    }
    const optionsFor = state => ({ now, signal: state.caller.signal, runWorkday: async () => attachInventoryEvidence(structuredClone(sharedJobs),
      { status: 'complete-inventory', firstParty: true, listingComplete: true, reportedTotal: sharedJobs.length, protocolOnly: true }),
      fetchImpl: (url, init) => {
        state.calls.push(url); state.signals.push(init.signal)
        if (url === listingURL) {
          state.listingReads++
          if (state.stage === 'ordinary-listing-transport') throw state.primary
        }
        const index = detailURLs.indexOf(url)
        if (index >= 0) {
          state.detailStarts.push(index)
          if (state.stage === 'fanout' || state.stage === 'ordinary-fanout-failure' && index === 1) {
            const release = deferred(); state.releases.push({ release, url })
            if (state.detailStarts.length === 2) state.entered.resolve()
            return release.promise
          }
        }
        return Promise.resolve(responseAt(url, state))
      } })
    for (const stage of ['listing-throw', 'listing-status-abort', 'fanout', 'closing-return', 'closing-throw']) for (const kind of kinds) await control(stage, kind, async reason => {
      current = makeState(stage, reason)
      const state = current, pending = reflect(run(optionsFor(state)))
      if (stage === 'fanout') { await state.entered.promise; state.caller.abort(reason) }
      const early = await bounded(pending)
      for (const [index, item] of state.releases.entries()) { if (index % 2) item.release.reject(Error('Authored late sibling rejection')); else item.release.resolve(responseAt(item.url, state)) }
      await pending; await turn(); await turn()
      exact(early, reason)
      if (stage === 'fanout') { assert.deepEqual(state.detailStarts, [0, 1]); assert.equal(state.validations, 0) }
      if (stage.startsWith('closing')) assert.equal(state.listingReads, 2)
      verifyListeners(state.signals)
    })
    await control('normal authored protocol and concurrency2', 'frozen', async reason => {
      current = makeState('normal', reason)
      const result = await run(optionsFor(current))
      assert.equal(result.length, 3); assert.deepEqual(current.detailStarts, [0, 1, 2]); assert.equal(current.listingReads, 2)
      verifyListeners(current.signals)
    })
    await control('normal closing reconciliation still rejects drift', 'frozen', async reason => {
      current = makeState('normal-drift', reason)
      const result = await reflect(run(optionsFor(current))); assert.equal(result.ok, false); assert.match(result.reason.message, /changed|drift/i)
      verifyListeners(current.signals)
    })
    const primaryKinds = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary primary'))]]
    for (const [label, primary] of primaryKinds) await control('ordinary primary ' + label, 'frozen', async reason => {
      current = makeState('ordinary-primary', reason); current.primary = primary
      exact(await reflect(run(optionsFor(current))), primary); await turn(); verifyListeners(current.signals)
    })
    await control('ordinary failure stops stalled sibling ownership', 'frozen', async reason => {
      current = makeState('ordinary-fanout-failure', reason)
      const state = current, pending = reflect(run(optionsFor(state)))
      await state.entered.promise
      const early = await bounded(pending)
      const remaining = state.signals.reduce((sum, signal, index, all) => all.indexOf(signal) === index ? sum + getEventListeners(signal, 'abort').length : sum, 0)
      state.caller.abort(reason)
      for (const item of state.releases) item.release.reject(Error('Authored late failed sibling'))
      await pending; await turn(); await turn()
      exact(early, state.primary); assert.equal(remaining, 0, 'Recorded source failure must release its stalled sibling listener')
      assert.deepEqual(state.detailStarts, [0, 1]); verifyListeners(state.signals)
    })
    if (source === 'aeries') for (const stage of ['ordinary-listing-syntax', 'ordinary-listing-transport']) await control(stage + ' wrapper preserves cause', 'frozen', async reason => {
      current = makeState(stage, reason)
      const state = current, parse = JSON.parse
      let syntaxReads = 0
      JSON.parse = (value, ...args) => {
        try { return parse(value, ...args) }
        catch (error) { if (value === '{ Authored malformed listing') { state.primary = error; syntaxReads++ } throw error }
      }
      let result
      try { result = await reflect(run(optionsFor(state))) } finally { JSON.parse = parse }
      assert.equal(result.ok, false); assert.equal(result.reason.cause, state.primary)
      assert.equal(result.reason.message, 'Aeries native listing failed: ' + state.primary.message)
      assert.equal(state.detailStarts.length, 0); verifyListeners(state.signals)
      if (stage === 'ordinary-listing-syntax') { assert.equal(syntaxReads, 1); assert.ok(state.primary instanceof SyntaxError) }
      else assert.equal(syntaxReads, 0)
    })
  }
  await turn()
  globalThis.setTimeout = nativeTimeout; globalThis.clearTimeout = nativeClearTimeout
  assert.equal(networkAttempts, 0)
  const failures = rows.filter(row => !row.pass)
  console.log(JSON.stringify({ source, mode, route, permissions, networkAttempts, provenance: mode === 'model' ? 'Authored inert contract-boundary lifecycle protocols only; no native/country/criteria/replay qualification.' : 'Actual production contracts; early unavailable injected collaborators only.',
    controls: rows.length, pass: rows.length - failures.length, fail: failures.length, rows }))
}
const backend = fileURLToPath(new URL('../', import.meta.url))
const cases = [
  ...['aeries', 'einfochips', 'finacus', 'experion'].map(source => ({ source, mode: 'actual', route: 'native' })),
  ...['aeries', 'einfochips', 'experion'].map(source => ({ source, mode: 'actual', route: 'public' })),
  { source: 'finacus', mode: 'actual', route: 'current-native' }, { source: 'finacus', mode: 'actual', route: 'current-public' },
  ...['aeries', 'einfochips', 'finacus', 'experion'].map(source => ({ source, mode: 'model', route: 'native' })),
]
for (const entry of cases) test(entry.source + ' ' + entry.mode + ' ' + entry.route + ' exported cancellation controls', () => {
  const label = entry.source + '-' + entry.mode + '-' + entry.route
  const result = spawnSync(process.execPath, ['--permission', '--allow-fs-read=' + backend, '--unhandled-rejections=strict',
    '--input-type=module', '--eval', '(' + scenario.toString() + ')(' + JSON.stringify(entry) + ')'],
  { cwd: backend, env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 20000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
  let receipt
  try { receipt = JSON.parse(result.stdout) } catch {}
  if (process.env.SOURCE_NATIVE_CONTROL_RECEIPTS) {
    fs.mkdirSync(process.env.SOURCE_NATIVE_CONTROL_RECEIPTS, { recursive: true })
    fs.writeFileSync(path.join(process.env.SOURCE_NATIVE_CONTROL_RECEIPTS, label + '.json'), JSON.stringify({
      label, commandPolicy: 'Child --permission; only backend read grant; strict rejections; no child/worker/addon grants', exit: result.status,
      error: result.error?.message ?? null, stderr: result.stderr, ...receipt,
    }, null, 2) + '\n')
  }
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.ok(receipt, result.stdout); assert.equal(receipt.networkAttempts, 0)
  assert.deepEqual(receipt.permissions, { addons: false, worker: false, child: false })
  assert.equal(receipt.fail, 0, JSON.stringify(receipt.rows.filter(row => !row.pass)))
  console.log(JSON.stringify({ label, controls: receipt.controls, pass: receipt.pass, fail: receipt.fail }))
})

