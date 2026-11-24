import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { parseCargillPage, parseCargillOfficialRole, parseCargillRmkDetail, CargillNativeWithdrawnRole } from './nativeContract.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-withdrawn-dairy-20261120.json.gz', import.meta.url))))
const rows = entry => parseCargillPage(JSON.parse(entry.response.body), entry.page, entry.total).jobs
const row = rows(fixture.listing).find(value => value.publicJobId === '102151532512')
const official = () => parseCargillOfficialRole(fixture.public.body, row, { now: fixture.capturedAt, deferIncompletePublicOffice: true })
const parse = body => parseCargillRmkDetail(body, fixture.native.finalURL, official(), { now: fixture.capturedAt })

test('new dairy withdrawal retains the exact original public and native response bytes', () => {
  for (const packet of [fixture.listing.response, fixture.public, fixture.native, fixture.healthy.listing.response, fixture.healthy.public, fixture.healthy.native]) {
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
    assert.equal(packet.status, 200)
  }
})

test('the current identity-bound dairy filled notice is withheld without a country, criteria or inventory claim', () => {
  assert.equal(official().requisitionId, '336113')
  assert.equal(official().title, 'Dairy Nutritionist')
  assert.throws(() => parse(fixture.native.body), error => {
    assert.ok(error instanceof CargillNativeWithdrawnRole)
    assert.equal(error.withdrawalProof.requisitionId, '336113')
    assert.equal(error.withdrawalProof.nativeRmkPublicId, '1375173257')
    assert.equal(error.withdrawalProof.nativeStatus, 'filled')
    for (const key of ['countryQualified', 'criteriaQualified', 'publicationDateQualified', 'sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(error.withdrawalProof[key], false)
    return true
  })
})

for (const [label, change] of [
  ['requisition', body => body.replaceAll('336113-en_US', '999999-en_US')],
  ['employer', body => body.replaceAll('urn:li:organization:2678', 'urn:li:organization:9999')],
  ['title', body => body.replaceAll('Dairy Nutritionist', 'Other Nutritionist')],
  ['notice', body => body.replaceAll('Sorry, this position has been filled.', 'Status is unavailable.')],
  ['notice visibility', body => body.replace('<strong>Sorry,', '<strong hidden>Sorry,')],
  ['contradictory country', body => body.replace('</head>', '<meta itemprop="addressCountry" content="IN"></head>')],
  ['contradictory role', body => body.replace('</head>', '<script type="application/ld+json">{"@type":"JobPosting"}</script></head>')],
  ['activation program', body => body.replace('self === top', 'self == top')],
  ['active application', body => body.replace('</body>', '<a href="/talentcommunity/apply/1375173257/">Apply now</a></body>')],
]) test('dairy withdrawal does not swallow a changed ' + label, () => {
  const changed = change(fixture.native.body)
  assert.notEqual(changed, fixture.native.body)
  assert.throws(() => parse(changed), error => !(error instanceof CargillNativeWithdrawnRole))
})

test('a current independently qualified requisition keeps its actual description, countries and posting date', () => {
  const healthyRow = rows(fixture.healthy.listing).find(value => value.sourceUrl === fixture.healthy.public.requestedURL)
  const healthyOfficial = parseCargillOfficialRole(fixture.healthy.public.body, healthyRow, { now: fixture.capturedAt, deferIncompletePublicOffice: true })
  const job = parseCargillRmkDetail(fixture.healthy.native.body, fixture.healthy.native.finalURL, healthyOfficial, { now: fixture.capturedAt })
  assert.equal(job.jobId, '336121')
  for (const key of ['title', 'country', 'postingDate', 'sourceDescription', 'sourceDetailComplete']) assert.deepEqual(job[key], fixture.healthy.job[key])
  assert.equal(job.sourceDetailComplete, true)
})
