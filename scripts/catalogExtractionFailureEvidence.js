import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'

const MAX_REASONS = 8
const MAX_SCAN = 32
const array = value => { try { return Array.isArray(value) } catch { return false } }
const record = value => value !== null && typeof value === 'object' && !array(value)
// Read data properties only: diagnostics must not execute arbitrary getters.
const property = (value, key) => {
  if (value === null || typeof value !== 'object') return undefined
  try { return Object.getOwnPropertyDescriptor(value, key) } catch { return {} }
}
const field = (value, key) => property(value, key)?.value
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : null
const identifier = (value, pattern) => typeof value === 'string' && value.length <= 80 && pattern.test(value) ? value : null
const name = value => identifier(value, /^[A-Za-z][A-Za-z0-9_.]*$/)
const code = value => identifier(value, /^[A-Z][A-Z0-9_]*$/)
const stage = value => identifier(value, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
function* dataElements(value) {
  if (!array(value)) return
  const length = field(value, 'length')
  if (!Number.isSafeInteger(length) || length < 0) return
  for (let index = 0; index < Math.min(length, MAX_SCAN); index++) yield field(value, String(index))
}
const message = value => {
  if (typeof value !== 'string') return null
  return value.slice(0, 4096)
    .replace(/https?:\/\/[^\s<>]+/gi, '[url]')
    .replace(/(["']?)\b(?:authorization|cookie|set-cookie|password|secret|api[-_]?key|(?:(?:access|refresh|id)[-_]?)?token)\1\s*[:=]\s*(?:"(?:\\.|[^"\\])*(?:"|$)|'(?:\\.|[^'\\])*(?:'|$)|[^\s,;}]+)/gi, '[redacted]')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[redacted]')
    .replace(/<[^>]*>[\s\S]*?(?:<\/[^>]*>|$)/g, '[markup]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 320) || null
}

function reason(value, depth = 0) {
  if (!record(value)) return null
  const result = { name: name(field(value, 'name')), message: message(field(value, 'message')), code: code(field(value, 'code')) }
  const cause = field(value, 'cause')
  if (depth < 2) result.cause = typeof cause === 'string' ? { message: message(cause) } : reason(cause, depth + 1)
  return result.name || result.message || result.code || result.cause ? result : null
}

const reasonText = value => value ? [value.name, value.message, value.code, reasonText(value.cause)].filter(Boolean).join(' ') : ''

// Internal audit diagnostics only. Qualified counts remain null in the worker.
export function extractionFailureDetails(error) {
  const nativeProperty = property(error, 'nativeEvidence')
  const native = nativeProperty?.value
  const privileged = ['AUDIT_DATABASE_BLOCKED', 'ERR_ACCESS_DENIED', 'ERR_DLOPEN_DISABLED'].includes(error?.code)
  const fallback = () => error?.code === 'AUDIT_DATABASE_BLOCKED'
    ? 'audit_database_blocked' : classifyScraperError(error ?? {}).failureKind
  if (!nativeProperty) return { failureKind: fallback() }
  if (!record(native)) return { failureKind: privileged ? fallback() : 'surface_drift_or_fail_closed' }

  const failures = field(native, 'failures')
  const packets = field(native, 'transportPackets')
  const jobs = field(native, 'jobs')
  const reasons = []
  const classificationTexts = []
  let observedReasons = 0
  const add = (value, origin, stage = null) => {
    if (!value) return
    observedReasons++
    classificationTexts.push(reasonText(value))
    if (reasons.length < MAX_REASONS) reasons.push({ origin, stage, ...value })
  }
  // Transport failures retain nested fetch causes that collection wrappers lose.
  for (const packet of dataElements(packets)) {
    if (!record(packet)) continue
    const status = field(packet, 'status')
    const failure = reason(field(packet, 'failure'))
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      add({ name: null, message: `HTTP ${status}`, code: null, cause: failure }, 'transport')
    } else add(failure, 'transport')
  }
  for (const failure of dataElements(failures)) {
    add(reason(failure), 'native-failure', stage(field(failure, 'stage')))
  }
  add(reason(field(error, 'cause')), 'error-cause')
  const failureEvidence = {
    type: 'native-failure-summary',
    stage: reasons.find(value => value.stage)?.stage ?? null,
    observedListingCount: count(field(native, 'observedListingCount')),
    partialJobsLength: array(jobs) ? count(field(jobs, 'length')) : null,
    cleanupAllowed: false, inventoryComplete: false, firstParty: null,
    failureCount: array(failures) ? count(field(failures, 'length')) : null,
    transportPacketCount: array(packets) ? count(field(packets, 'length')) : null,
    reasons,
    reasonsTruncated: observedReasons > MAX_REASONS || (array(failures) && field(failures, 'length') > MAX_SCAN)
      || (array(packets) && field(packets, 'length') > MAX_SCAN),
  }
  // A cleanup prohibition describes local safety, not a server access denial.
  const text = classificationTexts.join(' ').replace(/\bcleanup[\s-]+forbidden\b/gi, '')
  const classified = classifyScraperError({ message: text }).failureKind
  return {
    failureKind: privileged ? fallback() : classified === 'hard_failure' ? 'surface_drift_or_fail_closed' : classified,
    failureEvidence,
  }
}
