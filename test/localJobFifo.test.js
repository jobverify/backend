import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { LocalJobFifo, readJsonl, validateWorkerResult } from '../scripts/localJobFifo.js'

const temporary = async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-fifo-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return dir
}

test('producer adds durable jobs while exactly one FIFO consumer is busy', async t => {
  const queue = await LocalJobFifo.open(await temporary(t))
  await queue.enqueue([{ id: 'one', source: 'a', outboxFile: 'a.json', jobIndex: 0 }])
  let release
  const barrier = new Promise(resolve => { release = resolve })
  let active = 0, maximum = 0, closed = false
  const order = []
  const processing = queue.consume(async ref => {
    active++; maximum = Math.max(maximum, active); order.push(ref.id)
    if (ref.id === 'one') await barrier
    active--
    return { sequence: ref.sequence, id: ref.id, source: ref.source, status: 'unusable_input' }
  }, { producerClosed: () => closed })
  await new Promise(resolve => setImmediate(resolve))
  await queue.enqueue([{ id: 'two', source: 'b', outboxFile: 'b.json', jobIndex: 0 }, { id: 'three', source: 'b', outboxFile: 'b.json', jobIndex: 1 }])
  assert.equal(queue.references.length, 3)
  assert.deepEqual(order, ['one'])
  closed = true; release(); await processing
  assert.equal(maximum, 1)
  assert.deepEqual(order, ['one', 'two', 'three'])
  const reopened = await LocalJobFifo.open(queue.directory)
  assert.equal(reopened.completed.size, 3)
  assert.equal(reopened.pendingCount, 0)
})

test('resume skips scored jobs and deduplicates raw/enriched arrivals', async t => {
  const queue = await LocalJobFifo.open(await temporary(t))
  await queue.enqueue([{ id: 'one', source: 'a', outboxFile: 'a.json', jobIndex: 0 }])
  assert.equal(await queue.enqueue([{ id: 'one', source: 'a', outboxFile: 'enriched.json', jobIndex: 0 }]), 0)
  await queue.consume(ref => ({ sequence: ref.sequence, id: ref.id, source: ref.source, status: 'unusable_input' }), { producerClosed: () => true })
  await fs.appendFile(queue.resultPath, '{"interrupted":')
  const reopened = await LocalJobFifo.open(queue.directory)
  assert.equal(reopened.completed.size, 1)
  assert.ok((await fs.readdir(queue.directory)).some(name => name.includes('interrupted-tail')))
})

test('interior corruption and non-FIFO result sequences are rejected', async t => {
  const dir = await temporary(t)
  const file = path.join(dir, 'bad.jsonl')
  await fs.writeFile(file, '{}\n{broken}\n{}\n')
  await assert.rejects(async () => { for await (const _row of readJsonl(file)) {} }, /Corrupt JSONL/)
  const queue = await LocalJobFifo.open(dir)
  await queue.enqueue([{ id: 'a', source: 'a' }, { id: 'b', source: 'b' }])
  await assert.rejects(queue.consume(ref => ({ sequence: ref.sequence + 1, id: ref.id, source: ref.source, status: 'unusable_input' }), { producerClosed: () => true }), /identity/)
  assert.equal(queue.completed.size, 0)
})

test('classified response requires exactly four finite normalized probabilities and winning label', () => {
  const ref = { sequence: 1, id: 'a', source: 'a' }
  const probabilities = { 'Full-time Fresher': .1, 'Full-time Experienced': .6, Intern: .2, Contract: .1 }
  const valid = { ...ref, status: 'classified', probabilities, jobType: 'Full-time Experienced' }
  assert.equal(validateWorkerResult(ref, valid), valid)
  for (const row of [{ ...valid, probabilities: { ...probabilities, Contract: NaN } }, { ...valid, jobType: 'Contract' }, { ...valid, probabilities: { ...probabilities, extra: 0 } }]) assert.throws(() => validateWorkerResult(ref, row))
})
