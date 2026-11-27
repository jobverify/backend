import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readDaloopaDetail, runCurrentDaloopaData } from './nativeData20261115.js'
import { createDaloopaReplay, withDaloopaReplayClock } from './fixtures/replayNativeData20261115.js'

const bytes = gunzipSync(fs.readFileSync(new URL('./fixtures/current-replica-detail-20261115.json.gz', import.meta.url)))
const DETAIL_URL = 'https://daloopa.prod.in1.mynexthire.io/d17/careers/requisition/object'
const BODY = '{"source":"careers","id":"","code":"","reqId":46}'
const profile = JSON.parse(fs.readFileSync(new URL('./reviewedNativeData20261115.json', import.meta.url)))
const listingRow = profile.listing.reqDetailsBOList.find(row => row.reqId === 46)
const page = body => ({ label: 'detail-46', url: DETAIL_URL, method: 'POST', requestBody: BODY,
  bytes: body, text: body.toString('utf8') })

test('Daloopa current alternate reviewed backend replica preserves the exact original role data', () => {
  const result = readDaloopaDetail(page(bytes), 46, listingRow)
  assert.equal(result.nativeVersion, 'd17-wq-20261103052123')
  assert.equal(result.record.reqId, 46)
  assert.deepEqual(result.data, JSON.parse(bytes).data)
  assert.equal(Object.keys(result.record).length, 13)
})

test('Daloopa reconciles identical full criteria across reviewed backend replicas at opening and closing', async () => {
  const io = createDaloopaReplay((bytes, packet) => {
    if (!packet.label.startsWith('detail-')) return bytes
    return Buffer.from(bytes.toString('utf8').replace(/"v":"[^"]+"/, packet.phase === 'opening'
      ? '"v":"d17-at-20261103052156"' : '"v":"d17-wq-20261103052123"'))
  })
  const jobs = await withDaloopaReplayClock(() => runCurrentDaloopaData({ fetchImpl: io.fetchImpl }))
  assert.deepEqual(jobs.map(job => job.jobId), ['46', '45'])
  assert.equal(io.calls.length, 14)
  for (const job of jobs) {
    assert.equal(job.nativeOriginalEnvelope.v, 'd17-at-20261103052156')
    assert.equal(job.nativeClosingOriginalEnvelope.v, 'd17-wq-20261103052123')
    assert.deepEqual(job.nativeDetailData, job.nativeClosingDetailData)
    assert.equal(job.nativeRawDataSHA256, job.nativeClosingRawDataSHA256)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
})

for (const [label, change] of [
  ['duplicate version keys', value => value.replace('"v":', '"v":"d17-at-20261103052156","v":')],
  ['changed criteria', value => value.replace('India', 'United States')],
  ['extra envelope controls', value => value.replace('"status":200', '"status":200,"extraControl":false')],
]) test(`Daloopa still rejects ${label} despite replica tolerance`, () => {
  const changed = change(bytes.toString('utf8'))
  assert.notEqual(changed, bytes.toString('utf8'))
  assert.throws(() => readDaloopaDetail(page(Buffer.from(changed)), 46, listingRow), error => error.code === 'DALOOPA_NATIVE_DATA_GAP')
})
