import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { runScraperWithTimeout } from '../runner.js'
import {
  createNativeDetailRecovery, nativeDetailReceiptKey, readNativeDetailReceipt,
  rememberNativeDetailReceipt, runWithNativeDetailRecovery, NativeDetailRecoveryPendingError,
  currentNativeDetailRecovery,
} from '../utils/nativeDetailRecovery.js'

const clock = t => t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-24T00:00:00Z') })
const settle = async (t, operation) => {
  let outcome
  const pending = operation().then(value => { outcome = { value } }, error => { outcome = { error } })
  for (let i = 0; !outcome && i < 200; i++) { await setImmediate(); t.mock.timers.tick(10) }
  assert.ok(outcome, 'A bounded lifecycle must settle')
  await pending
  if (outcome.error) throw outcome.error
  return outcome.value
}
const wait = (ms, signal) => new Promise((resolve, reject) => {
  const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
  const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
  signal.addEventListener('abort', onAbort, { once: true })
})

test('runner continues a progressing detail tail across separately bounded source passes', async t => {
  clock(t)
  const signals = []
  let receipts
  const jobs = await settle(t, () => runScraperWithTimeout({ name: 'recovery-lifecycle', run: async ({ signal, nativeDetailRecovery }) => {
    signals.push(signal)
    await wait(30, signal)
    if (!nativeDetailRecovery) return [{ sourceDetailComplete: false }]
    receipts = nativeDetailRecovery.receipts
    const cached = readNativeDetailReceipt(nativeDetailRecovery, 'first')
    if (!cached) {
      rememberNativeDetailReceipt(nativeDetailRecovery, 'first', '<p>Verified first detail</p>')
      nativeDetailRecovery.pending++
      return [{ sourceDetailComplete: false }]
    }
    return [{ sourceDetailComplete: true }]
  } }, 50, { nativeDetailRecovery: true }))
  assert.deepEqual(jobs, [{ sourceDetailComplete: true }])
  assert.equal(signals.length, 2)
  assert.notEqual(signals[0], signals[1], 'Each pass must own its deadline controller')
  assert.equal(receipts.size, 0, 'Receipts must not escape their lifecycle')
})

test('recovery stops when a pass has no new verified detail progress', async t => {
  clock(t)
  let calls = 0
  const jobs = await runWithNativeDetailRecovery(async recovery => {
    calls++
    recovery.pending = 3
    return [{ sourceDetailComplete: false, sourceDetailFailureKind: 'budget-exhausted' }]
  })
  assert.equal(calls, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('ordinary transport and identity errors never become recovery retries', async t => {
  clock(t)
  const error = Object.assign(new Error('native employer identity mismatch'), { abortRetries: true })
  let calls = 0
  await assert.rejects(runWithNativeDetailRecovery(async () => { calls++; throw error }), value => value === error)
  assert.equal(calls, 1)
})

test('a pending required-scope failure stops after the next pass makes no progress', async t => {
  clock(t)
  let calls = 0, receipts
  await assert.rejects(runWithNativeDetailRecovery(async recovery => {
    calls++
    receipts = recovery.receipts
    if (calls === 1) rememberNativeDetailReceipt(recovery, 'native-role', { country: 'India' })
    recovery.pending = 2
    throw new NativeDetailRecoveryPendingError(2)
  }), error => error.code === 'NATIVE_DETAIL_RECOVERY_PENDING')
  assert.equal(calls, 2)
  assert.equal(receipts.size, 0)
})

test('recovery preserves the hard twelve-pass cap even if a caller requests more', async t => {
  clock(t)
  let calls = 0
  const jobs = await runWithNativeDetailRecovery(async recovery => {
    calls++
    rememberNativeDetailReceipt(recovery, 'role-' + calls, { country: 'India' })
    recovery.pending = 1
    return [{ sourceDetailComplete: false }]
  }, { maxPasses: 99 })
  assert.equal(calls, 12)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('the recovery lifecycle deadline aborts active work and clears retained payloads', async t => {
  clock(t)
  let calls = 0, active = 0, receipts
  await assert.rejects(settle(t, () => runWithNativeDetailRecovery(async (recovery, signal) => {
    calls++
    active++
    receipts = recovery.receipts
    try {
      await wait(30, signal)
      rememberNativeDetailReceipt(recovery, 'role-' + calls, { country: 'India' })
      recovery.pending = 1
      return []
    } finally { active-- }
  }, { maxDurationMs: 50 })), error => error.failureKind === 'native_detail_recovery_incomplete')
  assert.equal(calls, 2)
  assert.equal(active, 0)
  assert.equal(receipts.size, 0)
})

test('runner caller cancellation stops the active recovery pass and leaves no background work', async t => {
  clock(t)
  const controller = new AbortController()
  const reason = new Error('operator stopped source')
  let calls = 0, active = 0
  setTimeout(() => controller.abort(reason), 50)
  await assert.rejects(settle(t, () => runScraperWithTimeout({ name: 'cancel-recovery', run: async ({ signal, nativeDetailRecovery }) => {
    calls++
    active++
    try {
      await wait(30, signal)
      if (nativeDetailRecovery) {
        rememberNativeDetailReceipt(nativeDetailRecovery, 'role-' + calls, {})
        nativeDetailRecovery.pending = 1
      }
      return []
    } finally { active-- }
  } }, 100, { nativeDetailRecovery: true, signal: controller.signal })), error => error === reason)
  assert.equal(calls, 2)
  assert.equal(active, 0)
})

test('runner source timeout aborts and settles a hung pass without restarting it', async t => {
  clock(t)
  let calls = 0, active = 0
  await assert.rejects(settle(t, () => runScraperWithTimeout({ name: 'hung-recovery', run: async ({ signal }) => {
    calls++; active++
    try { await wait(1000, signal) } finally { active-- }
  } }, 30, { nativeDetailRecovery: true })), error => error.localTimeout === true)
  assert.equal(calls, 1)
  assert.equal(active, 0)
})

test('receipts are isolated by current board and role identity and expire after thirty minutes', t => {
  clock(t)
  const recovery = createNativeDetailRecovery()
  const key = nativeDetailReceiptKey('phenom', 'Employer A', 'https://a.example.com', 'R1', 'Engineer', 'Pune, India')
  rememberNativeDetailReceipt(recovery, key, { description: 'Verified employer text' })
  assert.equal(readNativeDetailReceipt(recovery, nativeDetailReceiptKey('phenom', 'Employer B', 'https://b.example.com', 'R1', 'Engineer', 'Pune, India')), null)
  const receipt = readNativeDetailReceipt(recovery, key)
  receipt.payload.description = 'Mutated outside cache'
  assert.equal(readNativeDetailReceipt(recovery, key).payload.description, 'Verified employer text')
  t.mock.timers.tick(1800000)
  assert.equal(readNativeDetailReceipt(recovery, key), null)
  assert.equal(recovery.receipts.size, 0)
})

test('receipt count and byte limits preserve admitted work and explicitly reject excess payloads', t => {
  clock(t)
  const recovery = createNativeDetailRecovery({ maxEntries: 1 })
  rememberNativeDetailReceipt(recovery, 'first', { text: 'Verified role description' })
  rememberNativeDetailReceipt(recovery, 'second', { text: 'Another verified role description' })
  assert.equal(readNativeDetailReceipt(recovery, 'second'), null)
  assert.equal(readNativeDetailReceipt(recovery, 'first').payload.text, 'Verified role description')
  assert.equal(recovery.capacityExceeded, true)
  const tiny = createNativeDetailRecovery({ maxBytes: 1 })
  rememberNativeDetailReceipt(tiny, 'role', { text: 'Verified role description' })
  assert.equal(tiny.receipts.size, 0)
  assert.equal(tiny.capacityExceeded, true)
})

test('late uncooperative work cannot repopulate receipts after a lifecycle ends', async t => {
  clock(t)
  let retained
  await runWithNativeDetailRecovery(async recovery => { retained = recovery; return [] })
  rememberNativeDetailReceipt(retained, 'late-role', { text: 'Late response' })
  assert.equal(retained.receipts.size, 0)
})

test('runner cancellation settles safely when source work ignores its signal past abort grace', async t => {
  clock(t)
  const controller = new AbortController()
  const reason = new Error('caller stopped uncooperative source')
  let retained, lateFinished = false
  setTimeout(() => controller.abort(reason), 10)
  await assert.rejects(settle(t, () => runScraperWithTimeout({ name: 'uncooperative-recovery', run: async ({ nativeDetailRecovery }) => {
    retained = nativeDetailRecovery
    await new Promise(resolve => setTimeout(resolve, 100))
    rememberNativeDetailReceipt(nativeDetailRecovery, 'late', { text: 'Late native response' })
    lateFinished = true
    return [{ sourceDetailComplete: true }]
  } }, 1000, { nativeDetailRecovery: true, signal: controller.signal, abortGraceMs: 10 })), error => error === reason)
  assert.equal(lateFinished, false)
  t.mock.timers.tick(100)
  await setImmediate()
  assert.equal(lateFinished, true)
  assert.equal(retained.receipts.size, 0)
})

test('concurrent source lifecycles retain separate recovery contexts and restore outside context', async t => {
  clock(t)
  const contexts = []
  await Promise.all(['Employer A', 'Employer B'].map(employer => runWithNativeDetailRecovery(async recovery => {
    contexts.push(recovery)
    rememberNativeDetailReceipt(recovery, 'same-role', { employer })
    await Promise.resolve()
    assert.equal(currentNativeDetailRecovery(), recovery)
    assert.equal(readNativeDetailReceipt(currentNativeDetailRecovery(), 'same-role').payload.employer, employer)
    return []
  })))
  assert.notEqual(contexts[0], contexts[1])
  assert.equal(currentNativeDetailRecovery(), undefined)
  assert.ok(contexts.every(context => context.closed && context.receipts.size === 0))
})
