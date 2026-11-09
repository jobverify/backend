import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, CAREERS_URL, parseBioRadListing, parseBioRadDetail } from './script.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/phase3-20261024/native-4.json.gz', import.meta.url))))

test('the captured AWS WAF HTTP202 stays a blocked soft failure with HTTP diagnostics', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({
    status: capture.status, url, headers: { get: name => name.toLowerCase() === 'x-amzn-waf-action' ? 'challenge' : null },
    text: async () => capture.body,
  }))
  await assert.rejects(run(), error => {
    assert.equal(error.status, 202)
    assert.equal(error.requestUrl, CAREERS_URL)
    assert.equal(error.finalUrl, CAREERS_URL)
    assert.equal(error.stage, 'landing')
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.abortRetries, true)
    return true
  })
})

test('current final browser responses independently satisfy native Bio-Rad India and full-description guards', () => {
  const load = name => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/phase3-20261024/' + name + '.json.gz', import.meta.url))))
  const listing = load('bio-sequential-listing')
  const detail = load('bio-sequential-detail')
  assert.equal(listing.status, 200)
  assert.equal(detail.status, 200)
  const parsed = parseBioRadListing(listing.body, listing.finalUrl)
  const role = parsed.jobs.find(row => row.sourceUrl === detail.finalUrl)
  assert.equal(parsed.total, 5)
  assert.ok(role)
  const job = parseBioRadDetail(detail.body, role, { now: detail.capturedAt })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.country, 'India')
  assert.ok(job.sourceDescription.length > 4000)
})
