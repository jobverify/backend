import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readInventoryEvidence } from './inventoryEvidence.js'

const validSource = (source) => typeof source === 'string'
  && /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source)
  && !source.endsWith('.')
  && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(source)

const writeRawRecord = async (type, fields, {
  source,
  dryRun = false,
  directory = process.env.SCRAPER_RAW_CAPTURE_DIRECTORY,
  now = new Date(),
} = {}) => {
  if (!dryRun || !String(directory || '').trim()) return null
  if (!validSource(source)) throw new Error('Invalid raw capture source')

  const capturedAt = new Date(now).toISOString()
  const eventId = randomUUID()
  const content = `${JSON.stringify({ version: 1, type, source, capturedAt, eventId, ...fields }, null, 2)}\n`
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
}, options)
