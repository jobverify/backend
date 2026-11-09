import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))))
const active = JSON.parse(readFileSync(new URL('./fixtures/additional-native-api-pages.json', import.meta.url)))[0]
const captures = [read('careers-response'), ...read('detail-responses'), active]
const replay = override => async url => {
  const capture = captures.find(row => row.url === url)
  assert.ok(capture, url)
  return url === active.url && override ? JSON.stringify(override(JSON.parse(active.body))) : capture.body
}

test('Skan crosschecks the active native API and excludes the stale India role without certifying closure', async () => {
  const jobs = await run({ fetchText: replay(), now: active.capturedAt })
  assert.equal(jobs.length, 16)
  assert.equal(jobs.some(job => job.jobId === '42722'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reason, 'native-active-listing-count-disagreement')
  const lead = jobs.find(job => job.jobId === '89302')
  assert.equal(lead.postingDate, '2026-09-21T09:47:32.277Z')
  assert.equal(lead.nativePublishedOn, '2026-09-21T09:47:32.277Z')
  assert.equal(lead.nativePublishedSinceDays, 32)
  assert.equal(lead.nativeLocations[0].countryCode, 'IN')
  assert.equal(lead.closingDate, null)
})

test('Skan rejects native API identity changes and unreviewed expiry or country fields', async () => {
  for (const change of [
    rows => [...rows, rows[0]],
    rows => rows.map((row, index) => index ? row : { ...row, title: 'Foreign role' }),
    rows => rows.map((row, index) => index ? row : { ...row, country: 'India' }),
    rows => rows.map((row, index) => index ? row : { ...row, expiresOn: '2026-01-01' }),
    rows => rows.map((row, index) => index ? row : { ...row, publishedOn: '2026-02-30T01:00:00Z' }),
    rows => rows.map((row, index) => index ? row : { ...row, jobLocations: row.jobLocations.map(location => ({ ...location, country: 'India' })) }),
  ]) await assert.rejects(run({ fetchText: replay(change), now: active.capturedAt }), /Skan native inventory/)
})

test('Skan prevents contradictory native countries and publication ages from admitting India roles', async () => {
  for (const change of [
    row => ({ ...row, jobLocations: row.jobLocations.map(location => ({ ...location, countryCode: 'US', countryName: 'United States' })) }),
    row => ({ ...row, publishedOn: '2026-10-23T00:00:00Z' }),
    row => ({ ...row, publishedOn: new Date(Date.parse(active.capturedAt) + 3600000).toISOString(), publishedSinceDays: 0 }),
    row => ({ ...row, publishedSinceDays: 900 }),
  ]) await assert.rejects(run({ now: active.capturedAt, fetchText: replay(rows => rows.map(row => row.id === 89302 ? change(row) : row)) }), /Skan native inventory/)
})
