import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { retainNativeFailureArtifact } from '../scripts/catalogExtractionFailureArtifacts.js'

const parent = fileURLToPath(new URL('../.tmp/', import.meta.url))
fs.mkdirSync(parent, { recursive: true })
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const body = Buffer.from('<html><main>Changed native job listing</main></html>')
const response = () => ({ url: 'https://careers.example.test/jobs/search?page=1', status: 200, headers: { 'content-type': 'text/html', date: 'Thu, 22 Oct 2026 17:13:04 GMT', cookie: 'PRIVATE_COOKIE', authorization: 'PRIVATE_AUTH' }, bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: body.toString('base64'), requestedAt: '2026-10-22T17:13:01.000Z', completedAt: '2026-10-22T17:13:04.000Z' })
const error = responses => Object.assign(Error('native layout changed'), { nativeEvidence: { retainedResponses: responses, jobs: [], cleanupAllowed: false } })
function withOutput(callback) {
  const directory = fs.mkdtempSync(path.join(parent, 'failure-artifact-'))
  try { return callback(directory) } finally {
    const target = path.resolve(directory)
    assert.ok(target.startsWith(path.resolve(parent) + path.sep))
    fs.rmSync(target, { recursive: true, force: true })
  }
}
const save = (failure, directory) => retainNativeFailureArtifact(failure, { outputDirectory: directory, source: 'fixture', attemptedAt: '2026-10-22T17:13:00.000Z', completedAt: '2026-10-22T17:13:05.000Z' })

test('failed native HTML bodies and original clocks survive as an isolated artifact reference', () => withOutput(directory => {
  const result = save(error([response()]), directory)
  assert.equal(result.retainedResponses, 1)
  const bytes = fs.readFileSync(path.join(directory, result.filename)), artifact = JSON.parse(bytes)
  assert.equal(sha(bytes), result.sha256)
  assert.equal(artifact.retainedResponses[0].rawBodyBase64, body.toString('base64'))
  assert.equal(artifact.retainedResponses[0].completedAt, '2026-10-22T17:13:04.000Z')
  assert.equal(artifact.attemptedAt, '2026-10-22T17:13:00.000Z')
  assert.equal(artifact.qualifiedJobCounts, null)
  assert.equal(artifact.verifiedZeroInventory, false)
  assert.equal(artifact.cleanupAllowed, false)
  assert.doesNotMatch(JSON.stringify(artifact), /PRIVATE_COOKIE|PRIVATE_AUTH/)
  assert.doesNotMatch(JSON.stringify(result), /rawBodyBase64|Changed native/)
}))

test('missing native bodies and accessor properties stay unavailable without executing getters', () => withOutput(directory => {
  const failure = {}; Object.defineProperty(failure, 'nativeEvidence', { get() { throw Error('getter executed') } })
  for (const item of [failure, null, error([]), error(undefined)]) assert.equal(save(item, directory), null)
  assert.deepEqual(fs.readdirSync(directory), [])
}))

test('corrupt, mismatched and credential-bearing packets are rejected while valid packets survive', () => withOutput(directory => {
  const invalid = [
    { ...response(), bodySHA256: '0'.repeat(64) }, { ...response(), bodyBytes: 0 },
    { ...response(), rawBodyBase64: body.toString('base64') + '!' },
    { ...response(), url: 'https://user:password@careers.example.test/jobs' },
    { ...response(), status: '200' }, { ...response(), rawBodyBase64: 'x'.repeat(3 * 1024 * 1024) },
  ]
  const result = save(error([...invalid, response()]), directory)
  assert.equal(result.retainedResponses, 1); assert.equal(result.rejectedResponses, invalid.length)
  const artifact = JSON.parse(fs.readFileSync(path.join(directory, result.filename)))
  assert.equal(artifact.verifiedZeroInventory, false)
  assert.doesNotMatch(JSON.stringify(artifact), /user:password/)
}))

test('repeat capture preserves the first failure artifact instead of overwriting it', () => withOutput(directory => {
  const first = save(error([response()]), directory), bytes = fs.readFileSync(path.join(directory, first.filename))
  const second = save(error([{ ...response(), status: 503 }]), directory)
  assert.equal(second.retentionFailure, 'existing-artifact-preserved')
  assert.deepEqual(fs.readFileSync(path.join(directory, first.filename)), bytes)
}))

test('packet scans are bounded and omissions remain explicit', () => withOutput(directory => {
  const result = save(error(Array.from({ length: 513 }, response)), directory)
  assert.equal(result.retainedResponses, 512); assert.equal(result.responseScanTruncated, true)
  const artifact = JSON.parse(fs.readFileSync(path.join(directory, result.filename)))
  assert.equal(artifact.observedResponseEntries, 513)
  assert.equal(artifact.inventoryComplete, false)
}))
