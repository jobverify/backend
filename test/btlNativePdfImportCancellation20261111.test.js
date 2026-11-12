import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {getEventListeners} from 'node:events'
import {isBuiltin, registerHooks, syncBuiltinESMExports} from 'node:module'
import childProcess from 'node:child_process'
import workerThreads from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

// The default is portable from backend/test. The override supports an exact
// outside-backend RED draft without changing a source module or existing test.
const backend = path.resolve(process.env.BTL_NATIVE_IMPORT_TEST_BACKEND || fileURLToPath(new URL('../', import.meta.url)))
const self = fileURLToPath(import.meta.url)
const sha = value => createHash('sha256').update(value).digest('hex')
if (!process.permission) {
  // Ordinary node --test entry owns orchestration only. Every source case runs
  // in a child with the same strict permissions as a direct audit invocation.
  test('BTL native import cancellation cases run with strict source permissions', () => {
    const args = ['--permission', '--allow-fs-read=' + backend,
      '--allow-fs-read=' + path.dirname(self), '--disallow-code-generation-from-strings',
      '--unhandled-rejections=strict', '--test-reporter=tap', self]
    const childEnvironment = {...process.env, NODE_OPTIONS: '', BTL_NATIVE_IMPORT_TEST_BACKEND: backend}
    delete childEnvironment.NODE_TEST_CONTEXT
    const result = childProcess.spawnSync(process.execPath, args, {cwd: backend,
      env: childEnvironment,
      encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 2 * 1024 * 1024})
    assert.equal(result.error, undefined, result.error?.message)
    const line = result.stdout.split(/\r?\n/).find(row => row.includes('BTL_NATIVE_IMPORT_GUARD '))
    const guard = line ? JSON.parse(line.split('BTL_NATIVE_IMPORT_GUARD ')[1]) : null
    const counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(name => {
      const match = result.stdout.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))
      return [name, match ? Number(match[1]) : null]
    }))
    console.log('BTL_NATIVE_IMPORT_CHILD ' + JSON.stringify({arguments: args, exitCode: result.status,
      counts, guard, stdoutSHA256: sha(result.stdout), stderrSHA256: sha(result.stderr)}))
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.ok(guard, 'The source child must emit its restriction receipt')
    assert.deepEqual(guard.attempts, {network: 0, database: 0, browser: 0, child: 0, worker: 0, addon: 0, fsWrite: 0, unexpectedModule: 0})
    assert.deepEqual(guard.permissions, {addons: false, worker: false, child: false, 'fs.write': false})
    assert.ok(counts.tests > 0, result.stdout); assert.equal(counts.pass, counts.tests)
    for (const name of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(counts[name], 0)
    assert.equal(guard.DOMMatrixDefined, false); assert.equal(guard.testUnchangedAtExit, true)
    assert.ok(guard.importedBackendFiles.every(row => row.unchangedAtExit))
  })
} else {
const nativeURL = pathToFileURL(path.join(backend, 'scraper/btlindia/native.js')).href
const pdfURL = pathToFileURL(path.join(backend, 'scraper/btlindia/nativePdf.js')).href
const fixturePath = path.join(backend, 'test/test-data/recruitmentGoal20261107/btl-current.json.gz')
const CAREERS = 'https://www.btlnet.co.in/careers.php'
const FIRST_PDF = 'https://www.btlnet.co.in/admin/image/career/Job%20Description%20-%20Firmware%20developer%20%205%20yrs.pdf'
const expectedTitles = [
  'Firmware Design engineer - 4 to 6 years',
  'Hardware Design engineer - 6 to 8 years',
  'Software design engineer (R&D Improvement & Support)- 5 to 8 years',
  'Hardware engineer (R&D Improvement & Support) - 6 to 8 years',
]
const allowedFiles = new Set([
  'scraper/btlindia/native.js',
  'scraper-support/shared/responseBodyDisposal.js',
  'scraper-support/utils/visibleNativeHtml.js',
  'scraper-support/utils/activeNativeHtml.js',
  'scraper-support/utils/inventoryEvidence.js',
  'scraper-support/utils/sourceObservationEvidence.js',
  'src/utils/jobSourceContent.js',
].map(name => path.resolve(backend, name)))
const attempts = {network: 0, database: 0, browser: 0, child: 0, worker: 0, addon: 0, fsWrite: 0, unexpectedModule: 0}
const imported = new Map(), controls = new Map(), cases = []
const deny = kind => () => { attempts[kind]++; throw Error('BTL native import test denies ' + kind) }
globalThis.fetch = deny('network')
for (const module of [http, https]) { module.request = deny('network'); module.get = deny('network') }
http2.connect = deny('network'); net.connect = deny('network'); net.createConnection = deny('network')
net.createServer = deny('network'); net.Socket.prototype.connect = deny('network')
tls.connect = deny('network'); tls.createServer = deny('network'); dgram.createSocket = deny('network')
for (const module of [dns, dns.promises]) for (const key of Object.keys(module)) {
  if (/^(?:lookup|resolve|reverse)/.test(key) && typeof module[key] === 'function') module[key] = deny('network')
}
for (const key of ['exec', 'execFile', 'spawn', 'fork', 'execSync', 'execFileSync', 'spawnSync']) childProcess[key] = deny('child')
workerThreads.Worker = class { constructor() { deny('worker')() } }
process.dlopen = deny('addon')
for (const module of [fs, fs.promises]) for (const key of Object.keys(module)) {
  if (/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(key) && typeof module[key] === 'function') module[key] = deny('fsWrite')
}
fs.createWriteStream = deny('fsWrite')
const originalOpen = fs.open, originalOpenSync = fs.openSync, originalPromiseOpen = fs.promises.open
const readOnlyFlags = flags => flags === 'r' || flags === 'rs' || flags === 0
fs.open = (filename, flags, ...rest) => readOnlyFlags(flags) ? originalOpen(filename, flags, ...rest) : deny('fsWrite')()
fs.openSync = (filename, flags, ...rest) => readOnlyFlags(flags) ? originalOpenSync(filename, flags, ...rest) : deny('fsWrite')()
fs.promises.open = (filename, flags, ...rest) => readOnlyFlags(flags) ? originalPromiseOpen(filename, flags, ...rest) : deny('fsWrite')()
syncBuiltinESMExports()
const permissions = Object.fromEntries(['addons', 'worker', 'child', 'fs.write'].map(kind => [kind, process.permission.has(kind)]))
assert.deepEqual(permissions, {addons: false, worker: false, child: false, 'fs.write': false})
assert.equal(typeof globalThis.DOMMatrix, 'undefined')
const testSHA256 = sha(fs.readFileSync(self))
globalThis.__btlNativeImportControls = controls
registerHooks({
  resolve(specifier, context, next) {
    if (/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier) || /saveToDB\.js(?:$|\?)/.test(specifier)) return deny('database')()
    if (/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier)) return deny('browser')()
    const result = next(specifier, context)
    if (result.url === pdfURL) {
      const id = new URL(context.parentURL).searchParams.get('nativeImportCase')
      const control = controls.get(id)
      assert.ok(control, 'Optional imports must belong to one admitted native collect case')
      control.resolutions++
      return {url: 'btl-native-import-control:' + id, shortCircuit: true}
    }
    if (!isBuiltin(result.url) && (!result.url.startsWith('file:') || !allowedFiles.has(fileURLToPath(result.url)))) return deny('unexpectedModule')()
    return result
  },
  load(url, context, next) {
    if (url.startsWith('btl-native-import-control:')) {
      const id = url.slice('btl-native-import-control:'.length)
      // Authored module initialization and failure only: no PDF parser, decoded
      // model, criteria or job is returned by this boundary control.
      return {format: 'module', shortCircuit: true, source:
        'const control=globalThis.__btlNativeImportControls.get(' + JSON.stringify(id) + ');await control.load();export const readNativePdf=(bytes,options)=>control.read(bytes,options);'}
    }
    if (url.startsWith('file:')) {
      const filename = fileURLToPath(url)
      if (!allowedFiles.has(filename)) return deny('unexpectedModule')()
      const bytes = fs.readFileSync(filename)
      imported.set(filename, {path: path.relative(backend, filename).replaceAll('\\', '/'), sha256: sha(bytes), bytes: bytes.length, filename})
    }
    return next(url, context)
  },
})
const fixtureBytes = fs.readFileSync(fixturePath)
assert.equal(sha(fixtureBytes), '1f8a6219f2feda1c553a44a2f5deff5ae7832286fd2e2b86823df31a5d22c10b')
const fixture = JSON.parse(gunzipSync(fixtureBytes)), packets = new Map(fixture.packets.map(packet => [packet.requestedURL, packet]))
assert.equal(packets.size, 5)
for (const packet of packets.values()) {
  const bytes = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(sha(bytes), packet.bodySHA256); assert.equal(bytes.length, packet.bodyBytes)
}
const reflect = promise => promise.then(value => ({ok: true, value}), reason => ({ok: false, reason}))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return {promise, resolve, reject} }
const turn = () => new Promise(resolve => setImmediate(resolve))
const bounded = async (promise, label) => {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Independent watchdog: ' + label)), 750) })]) }
  finally { clearTimeout(timer) }
}
const reasonFor = label => label === 'frozen' ? Object.freeze(Error('Authored frozen caller reason')) : ({null: null, false: false, zero: 0, empty: ''})[label]
const labels = ['null', 'false', 'zero', 'empty', 'frozen']

async function setup(mode, caller, reason) {
  const id = String(controls.size + 1), started = deferred(), late = deferred()
  const ordinary = Object.freeze(Object.assign(Error('Authored optional decoder boundary failure'), {code: 'AUTHORED_OPTIONAL_PDF_FAILURE'}))
  const control = {id, mode, started, late, ordinary, resolutions: 0, loads: 0, reads: 0, readerSignals: [], calls: []}
  control.load = () => {
    control.loads++
    if (mode === 'init-abort') caller.abort(reason)
    if (mode === 'load-failure') throw ordinary
    if (mode === 'loading') { started.resolve(); return late.promise }
  }
  control.read = async (bytes, options) => {
    control.reads++; control.readerSignals.push(options.signal)
    assert.equal(sha(bytes), '5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a')
    assert.equal(options.signal, caller?.signal)
    assert.ok(control.calls.some(call => call.url === FIRST_PDF && call.kind === 'pdf'))
    if (mode === 'decoding') { started.resolve(); await late.promise }
    throw ordinary
  }
  controls.set(id, control)
  const entry = await import(nativeURL + '?nativeImportCase=' + id)
  assert.equal(control.resolutions, 0, 'Importing the native collector leaves its optional decoder unresolved')
  const acquire = (url, options, kind) => {
    assert.equal(options.signal, caller?.signal)
    const packet = packets.get(url)
    assert.ok(packet, 'Only retained exact BTL career and PDF acquisitions are admitted')
    assert.equal(kind, url === CAREERS ? 'html' : 'pdf')
    control.calls.push({url, kind, bodySHA256: packet.bodySHA256, bytes: packet.bodyBytes})
    return Buffer.from(packet.bodyBase64, 'base64')
  }
  const options = {signal: caller?.signal, now: () => '2026-11-07T02:00:00Z',
    fetchText: async (url, init) => acquire(url, init, 'html').toString('utf8'),
    fetchPdf: async (url, init) => acquire(url, init, 'pdf')}
  return {control, options, collect: entry.collect}
}
function assertHeldRows(rows, control) {
  assert.deepEqual(rows.map(row => row.title), expectedTitles)
  assert.equal(rows.length, 4)
  assert.ok(rows.every(row => row.jobDescription === null && row.sourceDetailComplete === false && row.country === null))
  assert.ok(rows.every(row => row.sourceListingComplete === false && row.nativeCriteriaVisibilityQualified === false))
  assert.equal(rows[0].rawNativeRoleEvidence.nativePdfFailure.kind, 'AUTHORED_OPTIONAL_PDF_FAILURE')
  assert.equal(rows[0].rawNativeRoleEvidence.nativePdfFailure.message, control.ordinary.message)
  assert.ok(rows.slice(1).every(row => row.rawNativeRoleEvidence.nativePdfFailure.kind === 'not-attempted-after-native-unavailability'))
  assert.equal(rows.nativeCollectionEvidence.pagesFetched, undefined)
  assert.equal(rows.nativeCollectionEvidence.extractedDetailJobs, 0)
  assert.equal(rows.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(rows.nativeCollectionEvidence.nativeDiscoveryFailures.length, 1)
}
function receipt(control, extra = {}) {
  const row = {id: control.id, mode: control.mode, loads: control.loads, reads: control.reads,
    optionalResolutions: control.resolutions, calls: control.calls, parserStub: false,
    authoredModuleInitializationAndFailureOnly: true, ...extra}
  cases.push(row); console.log('BTL_NATIVE_IMPORT_CASE ' + JSON.stringify(row))
}

// Removing the abort race must fail before the test releases initialization;
// removing the post-import check must invoke a decoder after caller abort.
for (const mode of ['loading', 'decoding']) for (const settlement of ['resolve', 'reject']) for (const label of labels) {
  test('BTL native collect cancels pending ' + mode + ' with exact ' + label + ' before late ' + settlement, async () => {
    const caller = new AbortController(), reason = reasonFor(label)
    const {control, options, collect} = await setup(mode, caller, reason)
    const pending = reflect(collect(options))
    let exactBeforeRelease = false
    try {
      await bounded(control.started.promise, 'optional ' + mode + ' must start')
      assert.deepEqual(control.calls.map(call => call.url), [CAREERS, FIRST_PDF])
      caller.abort(reason)
      const result = await bounded(pending, 'caller abort must settle while optional ' + mode + ' remains pending')
      assert.equal(result.ok, false); assert.equal(result.reason, reason)
      exactBeforeRelease = true
      assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
    } finally {
      if (settlement === 'reject') control.late.reject(control.ordinary)
      else control.late.resolve()
      await bounded(pending, 'released operation must finish')
      await turn(); await turn(); await turn()
      receipt(control, {label, settlement, exactBeforeRelease, abortListenersAfter: getEventListeners(caller.signal, 'abort').length})
    }
    assert.equal(control.loads, 1)
    assert.equal(control.reads, mode === 'loading' ? 0 : 1)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  })
}
for (const label of labels) test('BTL native module initialization abort blocks decoder admission for ' + label, async () => {
  const caller = new AbortController(), reason = reasonFor(label)
  const {control, options, collect} = await setup('init-abort', caller, reason)
  const result = await bounded(reflect(collect(options)), 'initialization abort must settle')
  receipt(control, {label, exactReason: result.reason === reason})
  assert.equal(result.ok, false); assert.equal(result.reason, reason)
  assert.equal(control.loads, 1); assert.equal(control.reads, 0)
  assert.deepEqual(control.calls.map(call => call.url), [CAREERS, FIRST_PDF])
  assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
})
test('BTL native preabort preserves five caller reasons without reads, optional import or listeners', async () => {
  for (const label of labels) {
    const caller = new AbortController(), reason = reasonFor(label); caller.abort(reason)
    const {control, options, collect} = await setup('load-failure', caller, reason)
    const result = await bounded(reflect(collect(options)), 'preabort must settle')
    assert.equal(result.ok, false); assert.equal(result.reason, reason)
    assert.deepEqual(control.calls, []); assert.equal(control.resolutions, 0)
    assert.equal(control.loads, 0); assert.equal(control.reads, 0)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
    receipt(control, {label, exactReason: true})
  }
})
for (const mode of ['load-failure', 'read-failure']) for (const withSignal of [true, false]) {
  test('BTL native ordinary ' + mode + ' retains four held rows and stops after one PDF withSignal=' + withSignal, async () => {
    const caller = withSignal ? new AbortController() : undefined
    const {control, options, collect} = await setup(mode, caller)
    const rows = await bounded(collect(options), 'ordinary optional failure must return held rows')
    assertHeldRows(rows, control)
    assert.deepEqual(control.calls.map(call => call.url), [CAREERS, FIRST_PDF])
    assert.equal(control.loads, 1); assert.equal(control.reads, mode === 'load-failure' ? 0 : 1)
    if (caller) { assert.equal(caller.signal.aborted, false); assert.equal(getEventListeners(caller.signal, 'abort').length, 0) }
    receipt(control, {withSignal, heldRows: rows.length})
  })
}
for (const settlement of ['resolve', 'reject']) test('BTL overlapping collectors share import while one caller cancels before ' + settlement, async () => {
  const caller = new AbortController(), survivor = new AbortController(), reason = reasonFor('frozen')
  const {control, options, collect} = await setup('loading', caller)
  // The shared initialization belongs to the module, but each decoder admission
  // retains its own caller signal and the cancellation must not abort its peer.
  const survivorCalls = [], survivorOptions = {...options, signal: survivor.signal,
    fetchText: async (url, init) => { assert.equal(init.signal, survivor.signal); survivorCalls.push(url); return Buffer.from(packets.get(url).bodyBase64, 'base64').toString('utf8') },
    fetchPdf: async (url, init) => { assert.equal(init.signal, survivor.signal); survivorCalls.push(url); return Buffer.from(packets.get(url).bodyBase64, 'base64') }}
  control.read = async (bytes, init) => {
    control.reads++; control.readerSignals.push(init.signal)
    assert.equal(init.signal, survivor.signal)
    assert.equal(sha(bytes), '5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a')
    throw control.ordinary
  }
  const cancelled = reflect(collect(options)), surviving = reflect(collect(survivorOptions))
  let exactBeforeRelease = false
  try {
    await bounded(control.started.promise, 'shared import must start')
    await turn(); assert.deepEqual(survivorCalls, [CAREERS, FIRST_PDF])
    caller.abort(reason)
    const result = await bounded(cancelled, 'cancelled peer must settle while shared import is pending')
    assert.equal(result.ok, false); assert.equal(result.reason, reason)
    exactBeforeRelease = true; assert.equal(survivor.signal.aborted, false)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  } finally {
    if (settlement === 'reject') control.late.reject(control.ordinary)
    else control.late.resolve()
    await bounded(cancelled, 'released cancelled peer must finish')
    const result = await bounded(surviving, 'surviving peer must finish after shared import settles')
    await turn(); await turn()
    receipt(control, {settlement, exactBeforeRelease, survivorSignalAborted: survivor.signal.aborted, survivorCalls})
    assert.equal(result.ok, true); assertHeldRows(result.value, control)
  }
  assert.equal(control.loads, 1)
  assert.equal(control.reads, settlement === 'resolve' ? 1 : 0)
  assert.ok(control.readerSignals.every(signal => signal === survivor.signal))
  assert.equal(getEventListeners(survivor.signal, 'abort').length, 0)
})
test('BTL supplied decoder keeps its original caller signal and bypasses optional import', async () => {
  const caller = new AbortController(), {control, options, collect} = await setup('load-failure', caller)
  let suppliedCalls = 0
  const rows = await collect({...options, decodePdf: async (bytes, init) => {
    suppliedCalls++; assert.equal(init.signal, caller.signal)
    assert.equal(sha(bytes), '5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a')
    throw control.ordinary
  }})
  assertHeldRows(rows, control)
  assert.equal(suppliedCalls, 1); assert.equal(control.resolutions, 0)
  assert.equal(control.loads, 0); assert.equal(control.reads, 0)
  assert.equal(caller.signal.aborted, false); assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  receipt(control, {suppliedCalls, heldRows: rows.length})
})
after(() => {
  const files = [...imported.values()].map(({filename, ...row}) => ({...row, unchangedAtExit: sha(fs.readFileSync(filename)) === row.sha256}))
  const guard = {attempts, permissions, nodeVersion: process.version, DOMMatrixDefined: typeof globalThis.DOMMatrix !== 'undefined',
    fixtureSHA256: sha(fixtureBytes), testSHA256, testUnchangedAtExit: sha(fs.readFileSync(self)) === testSHA256,
    importedBackendFiles: files, authoredBoundaryOnly: true, parserStub: false, caseReceipts: cases.length}
  console.log('BTL_NATIVE_IMPORT_GUARD ' + JSON.stringify(guard))
  assert.deepEqual(attempts, {network: 0, database: 0, browser: 0, child: 0, worker: 0, addon: 0, fsWrite: 0, unexpectedModule: 0})
  assert.ok(files.every(file => file.unchangedAtExit)); assert.equal(guard.testUnchangedAtExit, true)
})
}
