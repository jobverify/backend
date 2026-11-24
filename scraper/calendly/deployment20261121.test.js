import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261121.json.gz', import.meta.url))))
const HOME = 'https://calendly.com/careers', FEED = 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true'
const ISLAND = 'https://calendly.com/_astro/islands.CIjqItJl.js'
const sourceBody = row => Buffer.from(row.bodyBase64, 'base64').toString('utf8')
const replay = (edit = row => row) => {
  let index = 0
  return async (url, init) => {
    const original = fixture.responses[index++]
    assert.ok(original, 'No uncaptured public request: ' + url)
    const row = edit({ ...original, body: sourceBody(original) }, index)
    assert.equal(url, row.url); assert.equal(init.method, 'GET'); assert.equal(init.body, undefined)
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error')
    const response = new Response(row.body, { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.finalURL }); return response
  }
}
const execute = edit => run({ now: () => fixture.capturedAt, fetchImpl: replay(edit) })

test('current coherent Calendly deployment reconciles all four native full roles, dates, countries and closing reads', async () => {
  const jobs = await execute(), audit = jobs.nativeCollectionEvidence, inventory = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(audit.observedNativeRecordCount, 4); assert.equal(audit.roles.length, 4)
  assert.equal(audit.publisher.signatureSHA256, '9fbf8906b0fd8a2f0f78dc7381a0f24e94afc139ce30ae37f80a2afd4ee76a1c')
  assert.equal(audit.fullClosingPublisherRenderersBoardFeedAndEveryRoleReconciled, true)
  assert.equal(audit.companyGlobalScopeQualified, false); assert.equal(audit.lifecycleCleanupAllowed, false)
  const native = JSON.parse(sourceBody(fixture.responses.find(row => row.url === FEED))).jobs
  for (const role of audit.roles) {
    const original = native.find(row => row.id === role.id)
    assert.equal(role.employer, 'Calendly'); assert.equal(role.country, 'United States')
    assert.deepEqual(role.sourceNativeRecord, original)
    assert.equal(role.originalPublicationDate, original.first_published)
    assert.equal(role.nativeUpdatedAtOriginal, original.updated_at)
    assert.equal(role.nativeDeadlineOriginal, original.application_deadline)
    assert.equal(role.fullCriteriaOutsideStructuredPayRangesExact, true)
    assert.equal(role.closingFullRoleCriteriaAndIdentityUnchanged, true)
  }
  assert.equal(inventory.status, 'complete-inventory'); assert.equal(inventory.reportedTotal, 4)
  assert.equal(inventory.indiaFacetCount, 0); assert.equal(inventory.listingComplete, true)
  assert.equal(inventory.lifecycleCleanupAllowed, false); assert.equal(isVerifiedEmptyEvidence(inventory), false)
  for (const row of fixture.responses) assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.bodySHA256)
})

for (const [name, edit, expected] of [
  ['employer substitution', payload => { payload.jobs[0].company_name = 'Different Employer' }, /employer.*identity/],
  ['explicit India role', payload => { payload.jobs[0].location.name = 'India'; payload.jobs[0].offices = [] }, /India role requires/],
  ['future original publication', payload => { payload.jobs[0].first_published = '2099-01-01T00:00:00Z' }, /publication.*date/],
  ['invalid native deadline', payload => { payload.jobs[0].application_deadline = '2026-13-01T00:00:00Z' }, /deadline.*date/],
  ['changed full criteria', payload => { payload.jobs[0].content += '<p>An additional required qualification.</p>' }, /full native own-role criteria/],
]) test('current deployment withholds India zero for ' + name, async () => {
  await assert.rejects(execute(row => {
    if (row.url !== FEED) return row
    const payload = JSON.parse(row.body); edit(payload); return { ...row, body: JSON.stringify(payload) }
  }), expected)
})

test('current deployment rejects changed executable bytes before reading native inventory', async () => {
  await assert.rejects(execute(row => row.url === ISLAND ? { ...row, body: row.body + '\nwindow.unreviewed=true' } : row), /renderer.*review/)
})

test('current deployment still reconciles closing executable bytes', async () => {
  await assert.rejects(execute((row, ordinal) => row.url === ISLAND && ordinal > 10 ? { ...row, body: row.body + '\nwindow.unreviewed=true' } : row), /closing.*renderer/)
})

test('current deployment rejects an added active closing recruitment declaration', async () => {
  await assert.rejects(execute((row, ordinal) => row.url === HOME && ordinal > 10
    ? { ...row, body: row.body + '<a href="https://foreign.example/jobs">More jobs</a>' } : row), /publisher.*program|program.*review/)
})
