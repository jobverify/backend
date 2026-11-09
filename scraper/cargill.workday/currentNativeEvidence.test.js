import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCargillPage, parseCargillOfficialRole, parseCargillRmkDetail } from './nativeContract.js'

const load = name => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/phase3-20261024/' + name + '.json.gz', import.meta.url))))

test('one current Cargill India listing and official SAP handoff pass existing native identity and description guards', () => {
  const listing = load('cargill-live-first-india-page')
  const publicRole = load('cargill-live-role')
  const nativeRole = load('cargill-live-sap')
  assert.equal(listing.status, 200)
  assert.equal(publicRole.status, 200)
  assert.equal(nativeRole.status, 200)
  const rows = parseCargillPage(JSON.parse(listing.body), 1, 85).jobs
  assert.equal(rows.length, 15)
  const row = rows.find(row => row.sourceUrl === publicRole.finalUrl)
  assert.ok(row)
  const official = parseCargillOfficialRole(publicRole.body, row, { now: publicRole.capturedAt })
  const job = parseCargillRmkDetail(nativeRole.body, nativeRole.finalUrl, official, { now: nativeRole.capturedAt })
  assert.equal(job.jobId, '336252')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.sourceDescription.length > 2000)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.sourceScopeComplete, false)
})
