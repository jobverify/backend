import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const pages = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))

test('the currently declared Lever board404 and native API404 retain an unknown inventory with fresh evidence', async () => {
  const requests = []
  const jobs = await run({ fetchPage: async url => {
    requests.push(url)
    const row = pages.find(page => page.requestedUrl === url)
    assert.ok(row, url)
    return row
  } })
  assert.ok(requests.includes('https://api.lever.co/v0/postings/amaze?mode=json'))
  const evidence = readInventoryEvidence(jobs)
  assert.ok(evidence)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.match(evidence.reason, /board404.*API404/)
  assert.ok(new Date(evidence.verifiedAt).getTime() > new Date('2026-11-01').getTime())
})

test('Amaze cancellation settles public page overrides which ignore their signal', async () => {
  const controller = new AbortController(), reason = Error('stop Amaze')
  await assert.rejects(run({ signal: controller.signal, fetchPage: () => { controller.abort(reason); return new Promise(() => {}) } }), error => error === reason)
})
