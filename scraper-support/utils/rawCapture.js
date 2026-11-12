import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { types as utilTypes } from 'node:util'
import { readInventoryEvidence } from './inventoryEvidence.js'

const validSource = (source) => typeof source === 'string'
  && /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source)
  && !source.endsWith('.')
  && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(source)

const nativeAuditError = (reason) => new TypeError(`Invalid nativeCollectionEvidence: ${reason}`)

const nativeAuditSnapshot = (jobs, source) => {
  if (utilTypes.isProxy(jobs)) return null
  const carrier = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')
  if (!carrier || !Object.hasOwn(carrier, 'value')) return null
  const audit = carrier.value
  // A proxy cannot establish a descriptor-backed opt-in without running traps.
  if (!audit || !['object', 'function'].includes(typeof audit) || utilTypes.isProxy(audit)) return null
  const flag = Object.getOwnPropertyDescriptor(audit, 'archiveNativeCollectionEvidence')
  if (!flag || !Object.hasOwn(flag, 'value') || flag.value !== true) return null
  const owner = Object.getOwnPropertyDescriptor(audit, 'source')
  if (!owner || !Object.hasOwn(owner, 'value') || owner.value !== source) {
    throw nativeAuditError('matching own source data required')
  }

  const ancestors = new Set()
  const snapshot = (value) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value
    if (typeof value !== 'object' || utilTypes.isProxy(value)) throw nativeAuditError('unsupported JSON data')
    if (ancestors.has(value)) throw nativeAuditError('cyclic data')
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype)) {
      throw nativeAuditError('non-plain JSON data')
    }
    const keys = Reflect.ownKeys(value)
    if (keys.some(key => typeof key !== 'string')) throw nativeAuditError('symbol keys are unsupported')
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length').value
      if (keys.length !== length + 1 || keys.some(key => key !== 'length'
        && (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= length))) {
        throw nativeAuditError('sparse or extended array')
      }
    }
    // Null prototypes prevent inherited serialization hooks on the snapshot.
    const result = array ? Object.setPrototypeOf([], null) : Object.create(null)
    ancestors.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!Object.hasOwn(descriptor, 'value')) throw nativeAuditError('accessor data is unsupported')
      Object.defineProperty(result, key, {
        value: snapshot(descriptor.value), enumerable: true, writable: true, configurable: true,
      })
    }
    ancestors.delete(value)
    return result
  }
  return snapshot(audit)
}

// Retry wrappers retain the original source error as an own data cause.
// Inspect no more than eight nodes; metadata traversal never invokes getters,
// proxy traps, inherited causes or serialization hooks. Failure stays failure.
const failureNativeAuditSnapshot = (error, source) => {
  const visited = new Set()
  let current = error
  for (let depth = 0; depth < 8; depth++) {
    if (!current || !['object', 'function'].includes(typeof current)
      || utilTypes.isProxy(current) || visited.has(current)) return null
    visited.add(current)
    const audit = nativeAuditSnapshot(current, source)
    if (audit) return audit
    const cause = Object.getOwnPropertyDescriptor(current, 'cause')
    if (!cause || !Object.hasOwn(cause, 'value')) return null
    current = cause.value
  }
  return null
}

const writeRawRecord = async (type, fields, {
  source,
  dryRun = false,
  directory = process.env.SCRAPER_RAW_CAPTURE_DIRECTORY,
  now = new Date(),
} = {}, nativeFailure) => {
  if (!dryRun || !String(directory || '').trim()) return null
  if (!validSource(source)) throw new Error('Invalid raw capture source')

  const nativeCollectionEvidence = type === 'capture'
    ? nativeAuditSnapshot(fields.jobs, source)
    : failureNativeAuditSnapshot(nativeFailure, source)
  const capturedAt = new Date(now).toISOString()
  const eventId = randomUUID()
  const content = `${JSON.stringify({ version: 1, type, source, capturedAt, eventId, ...fields,
    ...(nativeCollectionEvidence ? { nativeCollectionEvidence } : {}) }, null, 2)}\n`
  const root = path.resolve(directory)
  await fs.mkdir(root, { recursive: true })
  const canonicalRoot = await fs.realpath(root)
  const sourceDirectory = path.join(canonicalRoot, source)
  await fs.mkdir(sourceDirectory, { recursive: true })
  const canonicalSourceDirectory = await fs.realpath(sourceDirectory)
  const relative = path.relative(canonicalRoot, canonicalSourceDirectory)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid raw capture source directory')
  }

  const fileName = `${capturedAt.replace(/[:.]/g, '-')}-${eventId}.${type === 'capture' ? 'jobs' : 'failure'}.json`
  const filePath = path.join(canonicalSourceDirectory, fileName)
  const temporaryPath = path.join(canonicalSourceDirectory, `.${fileName}.tmp`)
  try {
    await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' })
    // Linking exposes a complete record atomically and refuses to replace an archive.
    await fs.link(temporaryPath, filePath)
  } finally {
    await fs.rm(temporaryPath, { force: true })
  }
  return filePath
}

/** Capture provider output before filtering, enrichment, classification, or normalization. */
export const saveRawSourceCapture = (jobs, options = {}) => {
  if (!Array.isArray(jobs)) return Promise.reject(new TypeError('Raw capture jobs must be an array'))
  return writeRawRecord('capture', {
    jobCount: jobs.length,
    jobs,
    inventoryEvidence: readInventoryEvidence(jobs) || null,
  }, options)
}

/** Failure records deliberately have no jobs field: a failed scrape is not an empty inventory. */
export const saveRawSourceFailure = (error, options = {}) => writeRawRecord('failure', {
  error: {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Unknown source failure'),
    ...(error?.code !== undefined ? { code: error.code } : {}),
    ...(error?.failureKind ? { failureKind: error.failureKind } : {}),
    ...(error?.classificationPending ? { classificationPending: true } : {}),
  },
  captureFile: options.captureFile || null,
}, options, error)
