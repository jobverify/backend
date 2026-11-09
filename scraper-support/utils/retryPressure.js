import { AsyncLocalStorage } from 'node:async_hooks'

const scopes = new AsyncLocalStorage()
const pressureByValue = new WeakMap()

const initialPressure = () => ({
  nestedScopes: 0, nestedAttempts: 0, nestedRetries: 0, nestedFailedAttempts: 0,
  nestedRetryDelayMs: 0, httpStatusCounts: {},
})

const attachPressure = (value, pressure) => {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return
  pressureByValue.set(value, { ...pressure, httpStatusCounts: { ...pressure.httpStatusCounts },
      ...(pressure.sourceAdmission ? { sourceAdmission: {
        ...pressure.sourceAdmission, groups: [...pressure.sourceAdmission.groups],
      } } : {}),
  })
}

// A source retry owns a scope; request retries inherit it. Concurrent sources
// receive separate async contexts, including when their requests interleave.
export const traceRetryPressure = operation => {
  const parent = scopes.getStore()
  const pressure = parent?.pressure || initialPressure()
  const nested = Boolean(parent)
  if (nested) pressure.nestedScopes++
  const execution = scopes.run({ pressure, nested }, async () => {
    try {
      const result = await operation()
      if (!nested) attachPressure(result, pressure)
      return result
    } catch (error) {
      if (!nested) attachPressure(error, pressure)
      throw error
    }
  })
  if (!nested) {
    // Cancellation may use one immutable reason for several sources. Retain a
    // separate snapshot on each operation so shared error identity cannot mix
    // their diagnostics. Register before returning to the awaiting runner.
    const settled = () => { attachPressure(execution, pressure) }
    execution.then(settled, settled)
  }
  return execution
}

export const recordRetryAttempt = attempt => {
  const scope = scopes.getStore()
  if (!scope?.nested) return
  scope.pressure.nestedAttempts++
  if (attempt > 1) scope.pressure.nestedRetries++
}

export const recordRetryFailure = () => {
  const scope = scopes.getStore()
  if (scope?.nested) scope.pressure.nestedFailedAttempts++
}

export const recordRetryDelay = delayMs => {
  const scope = scopes.getStore()
  if (scope?.nested) scope.pressure.nestedRetryDelayMs += delayMs
}

// Count a failed HTTP response at its creation, not at each retry wrapper that
// later handles the same error. These are shared-fetch observations only.
export const recordRetryHttpStatus = status => {
  const scope = scopes.getStore()
  if (!scope || !Number.isInteger(status) || status < 400 || status > 599) return
  const counts = scope.pressure.httpStatusCounts
  counts[status] = (counts[status] || 0) + 1
}

export const recordSourceAdmission = ({ status, groupKey, queueWaitMs = 0 }) => {
  const scope = scopes.getStore()
  if (!scope) return
  const admission = scope.pressure.sourceAdmission ||= {
    groups: [], admittedAttempts: 0, queuedAttempts: 0, queueWaitMs: 0,
  }
  if (!admission.groups.includes(groupKey)) admission.groups.push(groupKey)
  if (status === 'waiting') admission.queuedAttempts++
  else {
    if (status === 'admitted') admission.admittedAttempts++
    if (Number.isFinite(queueWaitMs) && queueWaitMs > 0) admission.queueWaitMs += queueWaitMs
  }
}

export const getRetryPressure = value => value != null
  && (typeof value === 'object' || typeof value === 'function') ? pressureByValue.get(value) : undefined
