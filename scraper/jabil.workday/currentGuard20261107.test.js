import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { runCurrentJabilFeed } from './currentPublicFeed.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

// Genuine retained opening/detail packets. This unit corpus deliberately reuses
// the opening list at closing; controlled mutations below are negative tests,
// not public captures. No network or current-live completeness claim is made.
const compressed = readFileSync(new URL('./test-data-20261107/current-public.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(compressed).digest('hex'), '360d0f830927944355391a60884e2c72d7ce00ccf26db8c3bf02aca41aa8dd05')
const records = JSON.parse(gunzipSync(compressed))
const target = 'J2468657'
const detailURL = 'https://careers.jabil.com/.rest/delivery/jobs?jobId=' + target
const now = () => '2026-11-07T05:00:00.000Z'
const run = async mutate => {
  let reads = 0
  const jobs = await runCurrentJabilFeed({ now, fetchImpl: async (url, init) => {
    reads++
    const row = records.find(row => row.url === String(url))
    assert.ok(row, 'Only retained declared URLs may be read: ' + url)
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'manual')
    assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
    let body = row.body
    if (mutate && url === detailURL) {
      const payload = JSON.parse(body)
      mutate(payload.jobs[0])
      body = JSON.stringify(payload)
    }
    const response = new Response(body, { status: row.status, headers: { 'content-type': row.contentType } })
    Object.defineProperty(response, 'url', { value: String(url) })
    return response
  } })
  return { jobs, reads }
}
const permanent = message => error => {
  assert.match(error.message, message)
  assert.equal(error.abortRetries, true)
  assert.equal(error.softFailure, true)
  assert.equal(error.failureKind, 'coverage_gap')
  assert.equal(error.lifecycleCleanupAllowed, false)
  return true
}

test('all 86 genuine native details retain raw criteria/date and partial scope', async () => {
  const { jobs, reads } = await run()
  assert.equal(jobs.length, 86)
  assert.equal(reads, 92)
  for (const job of jobs) {
    assert.equal(job.sourceDescription, job.nativeSourceRecord.Job_Description)
    assert.equal(job.jobDescription, job.nativeSourceRecord.Job_Description)
    assert.equal(job.postingDate, job.nativeSourceRecord.Start_Date)
    assert.ok(extractActiveDescription(job.sourceDescription).length >= 100)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const value of ['2026-02-30', '2025-02-29', '2026-04-31', '2026-13-01', '2026-01-00']) {
  test('synthetic native impossible calendar date fails closed: ' + value, async () => {
    await assert.rejects(run(detail => { detail.Start_Date = value }), permanent(/publication date/))
  })
}
for (const value of ['2024-02-29', '2000-02-29', '2026-02-28', '2026-04-30']) {
  test('valid calendar boundary preserves native date bytes: ' + value, async () => {
    const { jobs } = await run(detail => { detail.Start_Date = value })
    assert.equal(jobs.length, 86)
    const job = jobs.find(job => job.jobId === target)
    assert.equal(job.postingDate, value)
    assert.equal(job.nativeSourceRecord.Start_Date, value)
  })
}

const long = 'Required native duties and experience for this role. '.repeat(6)
for (const [name, value] of [
  ['hidden-only', '<div hidden>' + long + '</div>'],
  ['inert-only', '<section inert>' + long + '</section>'],
  ['aria-hidden-only', '<div aria-hidden="true">' + long + '</div>'],
  ['script-only', '<script>' + long + '</script>'],
  ['style-only', '<style>' + long + '</style>'],
  ['template-only', '<template>' + long + '</template>'],
  ['short visible with hidden padding', '<p>Required native duties.</p><div hidden>' + long + '</div>'],
  ['99 active characters with markup padding', '<p>' + 'a'.repeat(99) + '</p>'],
]) {
  test('synthetic incomplete active native criteria fail closed: ' + name, async () => {
    await assert.rejects(run(detail => { detail.Job_Description = value }), permanent(/full native criteria/))
  })
}
for (const [name, value] of [
  ['exactly 100 active characters', '<p>' + 'a'.repeat(100) + '</p>'],
  ['visible criteria with inactive decoration', '<p>' + long + '</p><div hidden>Inactive decorative text</div>'],
]) {
  test('active criteria boundary preserves whole native raw markup: ' + name, async () => {
    const { jobs } = await run(detail => { detail.Job_Description = value })
    assert.equal(jobs.length, 86)
    const job = jobs.find(job => job.jobId === target)
    assert.equal(job.sourceDescription, value)
    assert.equal(job.jobDescription, value)
    assert.equal(job.nativeSourceRecord.Job_Description, value)
  })
}


// Synthetic malformed criteria are parser negatives, not captured bad roles.
for (const [name, value] of [
  ['invalid numeric entity', '<p>&#1114112; ' + ('Native responsibilities and qualifications. '.repeat(8)) + '</p>'],
  ['unterminated quoted attribute', '<p data-native="' + ('Native responsibilities and qualifications. '.repeat(8))],
]) {
  test('malformed native criteria preserve the source coverage-gap error contract: ' + name, async () => {
    const { classifyScraperError } = await import('../../scraper-support/utils/failureClassification.js')
    await assert.rejects(run(detail => { detail.Job_Description = value }), error => {
      permanent(/full native criteria/)(error)
      assert.deepEqual(classifyScraperError(error), {
        softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap',
      })
      return true
    })
  })
}
