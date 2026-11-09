import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const LABELS = ['Full-time Fresher', 'Full-time Experienced', 'Intern', 'Contract']

export async function* readJsonl(file, { repairTail = false } = {}) {
  try { await fs.access(file) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  const decoder = new StringDecoder('utf8')
  let pending = '', validBytes = 0
  for await (const chunk of createReadStream(file)) {
    pending += decoder.write(chunk)
    let position
    while ((position = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, position)
      pending = pending.slice(position + 1)
      validBytes += Buffer.byteLength(`${line}\n`)
      if (!line.trim()) continue
      try { yield JSON.parse(line) } catch (error) { throw new Error(`Corrupt JSONL inside ${file}: ${error.message}`) }
    }
  }
  pending += decoder.end()
  if (!pending) return
  if (!repairTail) throw new Error(`Unterminated JSONL tail in ${file}`)
  try {
    const row = JSON.parse(pending)
    await durableAppend(file, '\n')
    yield row
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    await fs.writeFile(`${file}.interrupted-tail-${Date.now()}.txt`, pending, { flag: 'wx' })
    await fs.truncate(file, validBytes)
  }
}

export const durableAppend = async (file, content) => {
  const handle = await fs.open(file, 'a')
  try { await handle.writeFile(content, 'utf8'); await handle.sync() } finally { await handle.close() }
}

export const validateWorkerResult = (ref, row) => {
  if (row.sequence !== ref.sequence || row.id !== ref.id || row.source !== ref.source) throw new Error('Worker result identity differs from outstanding FIFO request')
  if (!['classified', 'unusable_input', 'native_error'].includes(row.status)) throw new Error('Unknown worker result status')
  if (row.status === 'classified') {
    const values = row.probabilities
    if (!values || Object.keys(values).length !== 4 || LABELS.some(label => !Object.hasOwn(values, label) || !Number.isFinite(values[label]) || values[label] < 0 || values[label] > 1)) throw new Error('Invalid four-option probabilities')
    if (Math.abs(LABELS.reduce((total, label) => total + values[label], 0) - 1) > .0001) throw new Error('Probabilities do not sum to one')
    if (!LABELS.includes(row.jobType) || values[row.jobType] + 1e-9 < Math.max(...Object.values(values))) throw new Error('Chosen job type differs from winning probability')
  }
  return row
}

export class LocalJobFifo {
  constructor(directory) {
    this.directory = directory
    this.queuePath = path.join(directory, 'queue.jsonl')
    this.resultPath = path.join(directory, 'classified-jobs.jsonl')
    this.references = []
    this.completed = new Set()
    this.identities = new Set()
    this.outboxFiles = new Set()
    this.active = false
    this.appendChain = Promise.resolve()
  }

  static async open(directory, { onHistoricalResult } = {}) {
    await fs.mkdir(directory, { recursive: true })
    const queue = new LocalJobFifo(directory)
    for await (const ref of readJsonl(queue.queuePath, { repairTail: true })) {
      if (ref.sequence !== queue.references.length + 1 || typeof ref.id !== 'string' || !ref.id) throw new Error('Invalid durable FIFO sequence')
      if (queue.identities.has(ref.id)) throw new Error('Duplicate durable job identity')
      queue.references.push(ref); queue.identities.add(ref.id); queue.outboxFiles.add(ref.outboxFile)
    }
    for await (const result of readJsonl(queue.resultPath, { repairTail: true })) {
      const ref = queue.references[queue.completed.size]
      if (!ref) throw new Error('Result has no durable FIFO request')
      validateWorkerResult(ref, result)
      queue.completed.add(result.sequence)
      await onHistoricalResult?.(result)
    }
    return queue
  }

  get pendingCount() { return this.references.length - this.completed.size }

  enqueue(references) {
    const operation = this.appendChain.then(async () => {
      const additions = []
      const staged = new Set()
      for (const ref of references) {
        if (this.identities.has(ref.id) || staged.has(ref.id)) continue
        staged.add(ref.id)
        additions.push({ ...ref, sequence: this.references.length + additions.length + 1, enqueuedAt: new Date().toISOString() })
      }
      if (additions.length) {
        await durableAppend(this.queuePath, additions.map(ref => `${JSON.stringify(ref)}\n`).join(''))
        for (const ref of additions) { this.references.push(ref); this.identities.add(ref.id); this.outboxFiles.add(ref.outboxFile) }
      }
      return additions.length
    })
    this.appendChain = operation
    return operation
  }

  async consume(processRequest, { producerClosed, onResult } = {}) {
    if (this.active) throw new Error('Only one FIFO consumer is allowed')
    this.active = true
    try {
      while (true) {
        const ref = this.references[this.completed.size]
        if (!ref) {
          if (producerClosed?.()) break
          await delay(100)
          continue
        }
        const result = validateWorkerResult(ref, await processRequest(ref))
        await durableAppend(this.resultPath, `${JSON.stringify(result)}\n`)
        this.completed.add(ref.sequence)
        await onResult?.(result)
      }
    } finally { this.active = false }
  }
}
