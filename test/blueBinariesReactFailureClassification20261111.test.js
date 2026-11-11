import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Parser } from 'acorn'
import { run } from '../scraper/bluebinaries/script.js'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'

const fixture = new URL('../scraper/bluebinaries/test-data/current-react-contract-20261111/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture), 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const packets = manifest.packets.slice(0, 2).map(row => {
  const metadata = readFileSync(new URL(row.metadata, fixture)), bytes = readFileSync(new URL(row.bodyFile, fixture))
  assert.equal(hash(metadata), row.metadataSHA256)
  assert.equal(hash(bytes), row.bodySHA256)
  return { ...JSON.parse(metadata), body: bytes.toString('utf8') }
})

function replay(changeAt = -1) {
  const sequence = [packets[0], packets[1], packets[0], packets[1]], reads = []
  let audits = 0
  return {
    reads, auditCount: () => audits,
    options: { onAudit: () => { audits++ }, fetchPage: async url => {
      const index = reads.length
      assert.ok(index < sequence.length, 'No uncaptured request is allowed')
      const packet = sequence[index]
      assert.equal(url, packet.url)
      reads.push(url)
      return { url: packet.url, status: packet.status, contentType: packet.contentType,
        headers: Object.fromEntries(packet.headers),
        // Explicit synthetic unknown-revision mutation of genuine retained data.
        body: packet.body + (index === changeAt ? '\n' : '') }
    } },
  }
}

for (const [name, index] of [['opening root', 0], ['opening entry', 1], ['closing root', 2], ['closing entry', 3]]) {
  test('unreviewed Blue React ' + name + ' stays a soft contract drift in the real classifier', async () => {
    const context = replay(index)
    await assert.rejects(run(context.options), error => {
      assert.equal(error.code, 'BLUEBINARIES_REACT_CONTRACT')
      assert.deepEqual(classifyScraperError(error), {
        softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed',
      })
      return true
    })
    assert.equal(context.reads.length, index + 1)
    assert.equal(context.auditCount(), 0)
  })
}

test('a genuine local parser fault remains hard and retains its exact cause', async t => {
  const context = replay(), cause = new Error('synthetic internal failure')
  t.mock.method(Parser.prototype, 'parse', () => { throw cause })
  await assert.rejects(run(context.options), error => {
    assert.equal(error.code, 'BLUEBINARIES_REACT_CONTRACT')
    assert.equal(error.cause, cause)
    const classification = classifyScraperError(error)
    assert.equal(classification.softFailure, false)
    assert.equal(classification.upstreamOutage, false)
    assert.ok(['hard_failure', 'parser_or_contract_error'].includes(classification.failureKind))
    return true
  })
  assert.equal(context.reads.length, 2)
  assert.equal(context.auditCount(), 0)
})

test('caller cancellation during a parser fault retains the exact reason', async t => {
  const context = replay(), controller = new AbortController(), reason = Object.freeze({ caller: 'Blue parser control' })
  t.mock.method(Parser.prototype, 'parse', () => { controller.abort(reason); throw new Error('synthetic internal failure') })
  await assert.rejects(run({ ...context.options, signal: controller.signal }), error => error === reason)
  assert.equal(context.reads.length, 2)
  assert.equal(context.auditCount(), 0)
})
