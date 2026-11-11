import assert from 'node:assert/strict'

// Manual event emission below tests routing only. It does not create an orphaned
// promise or establish Node's strict unhandled-rejection process behavior.
const routingControls = process.argv.includes('--manual-routing-controls')
const test = routingControls ? null : (await import('node:test')).default
const event = 'unhandledRejection'
const baseline = process.listeners(event)
const maximum = process.getMaxListeners()
const beforeCalls = [], afterCalls = []
const beforeObserver = reason => beforeCalls.push(reason)
const afterObserver = reason => afterCalls.push(reason)
process.on(event, beforeObserver)
const source = new URL('../scraper-support/runner.js', import.meta.url)
const snapshots = []
const owned = () => process.listeners(event).filter(listener => !baseline.includes(listener)
  && listener !== beforeObserver && listener !== afterObserver)
for (let index = 0; index < 16; index++) {
  if (index === 8) process.on(event, afterObserver)
  source.search = '?rejection-lifecycle-control=' + index
  await import(source.href)
  snapshots.push({ listeners: process.listeners(event), owned: owned() })
}
const cachedHandler = owned().at(-1)
await import(source.href)

if (!routingControls) {
  for (const [index, snapshot] of snapshots.entries()) {
    test(`query import ${index + 1} retains exactly one runner rejection handler`, () => {
      assert.equal(snapshot.owned.length, 1)
    })
  }
  test('query imports preserve every pre-existing unrelated listener by reference', () => {
    for (const snapshot of snapshots) {
      for (const listener of baseline) {
        assert.equal(snapshot.listeners.filter(candidate => candidate === listener).length,
          baseline.filter(candidate => candidate === listener).length)
      }
    }
  })
  test('query imports preserve user listeners installed before and between imports', () => {
    for (const [index, snapshot] of snapshots.entries()) {
      assert.equal(snapshot.listeners.filter(listener => listener === beforeObserver).length, 1)
      assert.equal(snapshot.listeners.filter(listener => listener === afterObserver).length, index < 8 ? 0 : 1)
    }
  })
  test('a fresh module replaces its previous owned callback with the latest callback', () => {
    for (let index = 1; index < snapshots.length; index++) {
      assert.equal(snapshots[index].owned.length, 1)
      assert.notEqual(snapshots[index].owned[0], snapshots[index - 1].owned[0])
      assert.equal(snapshots[index].listeners.includes(snapshots[index - 1].owned[0]), false)
    }
  })
  test('a cached import retains the single current callback', () => {
    assert.deepEqual(owned(), [cachedHandler])
  })
  test('query imports retain the existing process listener limit', () => {
    assert.equal(process.getMaxListeners(), maximum)
  })
} else {
  const results = []
  const control = (name, action) => {
    try { action(); results.push({ name, pass: true }) }
    catch (error) { results.push({ name, pass: false, failure: error.message }) }
  }
  control('manual routing setup retains one runner listener after16imports', () => assert.equal(owned().length, 1))
  const close = Object.assign(new Error('Protocol error: Session closed'), {
    name: 'TargetCloseError', stack: 'TargetCloseError: Protocol error\n at CdpCDPSession.send (puppeteer-core/lib/puppeteer/cdp/CdpSession.js:69:35)',
  })
  const wait = Object.assign(new Error('Timed out after waiting 10000ms'), {
    name: 'TimeoutError', stack: 'TimeoutError: Timed out after waiting 10000ms\n at puppeteer-core/lib/puppeteer/common/util.js:232:19',
  })
  const softCases = [
    ['Puppeteer target close', close, '[runner] Ignored late Puppeteer browser-close rejection:'],
    ['Puppeteer wait timeout', wait, '[runner] Ignored late Puppeteer wait-timeout rejection:'],
    ['nested Puppeteer wait timeout', new Error('Worker cleanup failed', { cause: wait }), '[runner] Ignored late Puppeteer wait-timeout rejection:'],
    ['provider DNS failure', Object.assign(new Error('Synthetic provider ENOTFOUND'), { code: 'ENOTFOUND' }), '[runner] Ignored late scraper soft-failure rejection (network_or_timeout):'],
    ['blocked provider response', new Error('Synthetic HTTP_403'), '[runner] Ignored late scraper soft-failure rejection (blocked_or_access_denied):'],
    ['provider surface drift', new Error('Synthetic source surface changed'), '[runner] Ignored late scraper soft-failure rejection (surface_drift_or_fail_closed):'],
    ['pending provider response', new Error('Synthetic HTTP_202'), '[runner] Ignored late scraper soft-failure rejection (upstream_response_pending):'],
    ['explicit soft failure', Object.assign(new Error('Synthetic source held'), { softFailure: true, failureKind: 'synthetic_hold' }), '[runner] Ignored late scraper soft-failure rejection (synthetic_hold):'],
  ]
  for (const [label, reason, prefix] of softCases) {
    control(`manual emitted ${label} produces one diagnostic and preserves user observers`, () => {
      const diagnostics = [], original = console.error
      const beforeCount = beforeCalls.length, afterCount = afterCalls.length
      console.error = (...args) => diagnostics.push(args)
      try { assert.equal(process.emit(event, reason, Promise.resolve()), true) }
      finally { console.error = original }
      assert.equal(diagnostics.length, 1)
      assert.deepEqual(diagnostics[0], [prefix, reason.message || reason])
      assert.equal(beforeCalls.length, beforeCount + 1)
      assert.equal(afterCalls.length, afterCount + 1)
      assert.equal(beforeCalls.at(-1), reason)
      assert.equal(afterCalls.at(-1), reason)
    })
  }
  const hardCases = [
    ['ordinary error', new Error('Synthetic fatal failure')],
    ['programming error', new TypeError('Synthetic parser is not a function')],
    ['configuration error', Object.assign(new Error('Synthetic missing local file'), { code: 'ENOENT' })],
    ['local deadline', Object.assign(new Error('Synthetic timed out'), { localTimeout: true })],
    ['frozen error', Object.freeze(new Error('Synthetic frozen fatal failure'))],
  ]
  for (const [label, reason] of hardCases) {
    control(`manual emitted ${label} throws the exact reason without a soft-failure diagnostic`, () => {
      const diagnostics = [], original = console.error
      console.error = (...args) => diagnostics.push(args)
      try { assert.throws(() => process.emit(event, reason, Promise.resolve()), error => error === reason) }
      finally { console.error = original }
      assert.deepEqual(diagnostics, [])
      assert.equal(beforeCalls.at(-1), reason)
    })
  }
  const failed = results.filter(result => !result.pass)
  console.log(JSON.stringify({ mode: 'manual-event-routing-controls-only', controls: results.length,
    pass: results.length - failed.length, fail: failed.length, results }))
  process.exitCode = failed.length ? 1 : 0
}
