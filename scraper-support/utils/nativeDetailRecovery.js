import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { AsyncLocalStorage } from 'node:async_hooks'

const recoveryContext = new AsyncLocalStorage()
export const currentNativeDetailRecovery = () => recoveryContext.getStore()

export const NATIVE_DETAIL_RECOVERY_MAX_PASSES = 12
export const NATIVE_DETAIL_RECOVERY_MAX_MS = 30 * 60 * 1000
export const NATIVE_DETAIL_SCOPE_PASS_MS = 120 * 1000
const MAX_RECEIPT_BYTES = 32 * 1024 * 1024
const MAX_RECEIPT_ENTRIES = 10000
const MAX_RECEIPT_PAYLOAD_BYTES = 2 * 1024 * 1024

export const createNativeDetailRecovery = ({ maxBytes = MAX_RECEIPT_BYTES, maxEntries = MAX_RECEIPT_ENTRIES } = {}) => ({
  receipts: new Map(), pending: 0, progress: 0, startedAt: Date.now(), verifiedAt: null,
  receiptBytes: 0, maxBytes: Math.min(MAX_RECEIPT_BYTES, Math.max(1, maxBytes)),
  maxEntries: Math.min(MAX_RECEIPT_ENTRIES, Math.max(1, maxEntries)),
})

// Include the board and the current advertised identity/location in every key.
// A receipt cannot introduce a job that was absent from this pass's listing.
export const nativeDetailReceiptKey = (...identity) => createHash('sha256').update(JSON.stringify(identity)).digest('hex')

export const nativeDetailPassBudget = (recovery, requestedMs) => recovery?.passDeadlineAt
  ? Math.max(0, Math.min(requestedMs, recovery.passDeadlineAt - Date.now())) : requestedMs

const useReceiptClock = (recovery, fetchedAt) => {
  if (!recovery.verifiedAt || fetchedAt < recovery.verifiedAt) recovery.verifiedAt = fetchedAt
}

export const readNativeDetailReceipt = (recovery, key) => {
  if (!recovery?.receipts || recovery.closed) return null
  const receipt = recovery.receipts.get(key)
  const age = Date.now() - Number(receipt?.fetchedAt)
  if (!receipt || age < 0 || age >= NATIVE_DETAIL_RECOVERY_MAX_MS
    || Date.now() - recovery.startedAt >= NATIVE_DETAIL_RECOVERY_MAX_MS) {
    recovery.receiptBytes = Math.max(0, (recovery.receiptBytes || 0) - (receipt?.data?.length || 0))
    recovery.receipts.delete(key)
    return null
  }
  useReceiptClock(recovery, receipt.fetchedAt)
  try {
    return { payload: JSON.parse(gunzipSync(receipt.data, { maxOutputLength: MAX_RECEIPT_PAYLOAD_BYTES }).toString('utf8')), fetchedAt: receipt.fetchedAt }
  } catch { return null }
}

export const rememberNativeDetailReceipt = (recovery, key, payload, fetchedAt = Date.now()) => {
  if (!recovery?.receipts || recovery.closed || Date.now() - recovery.startedAt >= NATIVE_DETAIL_RECOVERY_MAX_MS) return
  const serialized = JSON.stringify(payload)
  if (Buffer.byteLength(serialized) > MAX_RECEIPT_PAYLOAD_BYTES) { recovery.capacityExceeded = true; return }
  const data = gzipSync(serialized)
  const previousBytes = recovery.receipts.get(key)?.data?.length || 0
  const nextBytes = (recovery.receiptBytes || 0) - previousBytes + data.length
  if (nextBytes > (recovery.maxBytes ?? MAX_RECEIPT_BYTES)
    || !recovery.receipts.has(key) && recovery.receipts.size >= (recovery.maxEntries ?? MAX_RECEIPT_ENTRIES)) {
    recovery.capacityExceeded = true
    return
  }
  if (!recovery.receipts.has(key)) recovery.progress++
  recovery.receipts.set(key, { data, fetchedAt })
  recovery.receiptBytes = nextBytes
  useReceiptClock(recovery, fetchedAt)
}

export class NativeDetailRecoveryPendingError extends Error {
  constructor(pending) {
    super('Required native country details remain pending for ' + pending + ' currently listed roles')
    this.name = 'NativeDetailRecoveryPendingError'
    this.code = 'NATIVE_DETAIL_RECOVERY_PENDING'
    this.softFailure = true
    this.abortRetries = true
    this.failureKind = 'native_detail_recovery_incomplete'
  }
}

// These are continuations of one source lifecycle, not transport retries. Each
// operation gets its own existing source deadline; the entire session also has
// a finite clock and pass cap. Successful receipts never outlive this session.
export const runWithNativeDetailRecovery = async (operation, {
  signal = null, maxPasses = NATIVE_DETAIL_RECOVERY_MAX_PASSES,
  maxDurationMs = NATIVE_DETAIL_RECOVERY_MAX_MS,
} = {}) => {
  const recovery = createNativeDetailRecovery()
  const duration = Math.min(NATIVE_DETAIL_RECOVERY_MAX_MS, Math.max(1, Number(maxDurationMs) || NATIVE_DETAIL_RECOVERY_MAX_MS))
  const passes = Math.min(NATIVE_DETAIL_RECOVERY_MAX_PASSES, Math.max(1, Math.floor(Number(maxPasses)) || 1))
  const controller = new AbortController()
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const exhausted = Object.assign(new Error('Native detail recovery lifecycle exhausted'), {
    softFailure: true, abortRetries: true, failureKind: 'native_detail_recovery_incomplete',
  })
  const timer = setTimeout(() => controller.abort(exhausted), duration)
  try {
    let lastPendingError
    for (let pass = 0; pass < passes; pass++) {
      combinedSignal.throwIfAborted()
      recovery.pending = 0
      recovery.unrecoverable = false
      const previousProgress = recovery.progress
      let result
      try { result = await recoveryContext.run(recovery, () => operation(recovery, combinedSignal)) }
      catch (error) {
        combinedSignal.throwIfAborted()
        if (!(error instanceof NativeDetailRecoveryPendingError)) throw error
        lastPendingError = error
      }
      combinedSignal.throwIfAborted()
      if (!recovery.pending || recovery.unrecoverable || recovery.capacityExceeded || recovery.progress <= previousProgress || pass + 1 === passes) {
        if (result !== undefined) return result
        throw lastPendingError || exhausted
      }
    }
    throw exhausted
  } finally {
    clearTimeout(timer)
    recovery.closed = true
    recovery.receipts.clear()
    recovery.receiptBytes = 0
  }
}
