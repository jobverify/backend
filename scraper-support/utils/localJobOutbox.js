import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

let sequence = 0
const validSource = source => typeof source === 'string'
  && /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source)
  && !source.endsWith('.')
  && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(source)

export class LocalJobOutboxPersistenceError extends Error {
  constructor(source, cause) {
    super(`Local job outbox could not persist [${source}]: ${cause?.message || cause}`, { cause })
    this.name = 'LocalJobOutboxPersistenceError'
    this.persistenceBlocked = true
    this.abortPipeline = true
  }
}

/** Publish a complete source batch atomically; queue consumers never see a partial JSON file. */
export const saveLocalJobOutbox = async (jobs, {
  source,
  dryRun = false,
  directory = process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY,
  now = new Date(),
  capturedAt = null,
  captureFile = null,
  phase = 'enriched_description',
} = {}) => {
  if (!dryRun || !String(directory || '').trim()) return null
  let temporaryPath = null
  try {
    if (!validSource(source)) throw new Error('Invalid local job outbox source')
    if (!Array.isArray(jobs)) throw new TypeError('Local job outbox jobs must be an array')
    if (!['raw_provider_description', 'enriched_description'].includes(phase)) throw new Error('Invalid local job outbox phase')
    const availableAt = new Date(now).toISOString()
    const eventId = randomUUID()
    const content = `${JSON.stringify({
      version: 1, source, capturedAt: capturedAt ? new Date(capturedAt).toISOString() : availableAt,
      availableAt, eventId, phase, jobCount: jobs.length, jobs, captureFile,
    }, null, 2)}\n`
    const root = path.resolve(String(directory).trim())
    await fs.mkdir(root, { recursive: true })
    const fileName = `${availableAt.replace(/[:.]/g, '-')}-${String(sequence++).padStart(8, '0')}-${eventId}-${source}.jobs.json`
    const filePath = path.join(root, fileName)
    temporaryPath = path.join(root, `.${fileName}.tmp`)
    const handle = await fs.open(temporaryPath, 'wx')
    try {
      await handle.writeFile(content, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    // A hard link publishes the flushed file atomically and cannot replace an existing batch.
    await fs.link(temporaryPath, filePath)
    if (process.platform !== 'win32') {
      const directoryHandle = await fs.open(root, 'r')
      try { await directoryHandle.sync() } finally { await directoryHandle.close() }
    }
    return filePath
  } catch (error) {
    throw new LocalJobOutboxPersistenceError(source, error)
  } finally {
    if (temporaryPath) await fs.rm(temporaryPath, { force: true })
  }
}
