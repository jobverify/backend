import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run, buildApplyUrl, CAREERS_URL, PROVIDER_METADATA } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261030.json.gz', import.meta.url))))
const response = fixture.responses[0]
const bytes = Buffer.from(response.bodyBase64, 'base64')
assert.equal(bytes.length, response.bytes)
assert.equal(createHash('sha256').update(bytes).digest('hex'), response.sha256)
const original = bytes.toString('utf8')
const collect = async (html = original, options = {}) => {
  const audits = []
  const jobs = await run({ fetchText: async () => html, onAudit: audit => audits.push(audit), ...options })
  return { jobs, audit: audits[0], evidence: readInventoryEvidence(jobs) }
}

test('the six authentic title-only observations keep country unknown rather than inheriting corporate offices', async () => {
  const { jobs, audit, evidence } = await collect()
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].title, 'BPO Workflow Manager (Insurance Ops - Remote)')
  for (const job of jobs) {
    assert.equal(job.country, null)
    assert.equal(job.location, null)
    assert.equal(job.city, null)
    assert.equal(job.state, null)
    assert.deepEqual(job.locations, [])
    assert.equal(job.jobId, null)
    assert.equal(job.requisitionId, null)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(isIndiaJob(job), false)
  }
  assert.equal(audit.originalHTML, original)
  assert.equal(audit.observations.length, 6)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.notEqual(evidence.status, 'verified-empty')
})

test('the actual normalizer and public India filter cannot restore a provider country default or corporate location', async () => {
  const { jobs } = await collect()
  const normalized = jobs.map(job => normalizeScrapedJob(job, PROVIDER_METADATA))
  assert.equal(normalized.length, 6)
  assert.equal(normalized.every(job => job.country === null && job.location === null && !isIndiaJob(job)), true)
})

test('the declared email and application instructions stay literal without an invented subject prefix', async () => {
  const { jobs, audit } = await collect()
  assert.equal(buildApplyUrl('BPO Workflow Manager (Insurance Ops - Remote)'), 'mailto:hr@selectsys.com')
  assert.equal(jobs[0].applyUrl, 'mailto:hr@selectsys.com')
  assert.match(audit.application.instructions, /subject/i)
  assert.match(audit.application.instructions, /resume/i)
  assert.ok(jobs[0].sourceNativeRole.title === jobs[0].title)
  assert.equal(jobs[0].sourceCountryScopeUnresolved, true)
})

test('metadata-bearing genuine HTML is accepted without qualifying its unknown country or detail', async () => {
  const { jobs } = await collect({ html: original, status: 200, url: CAREERS_URL })
  assert.equal(jobs.length, 6)
  assert.equal(jobs.filter(isIndiaJob).length, 0)
})

for (const [label, wrap] of [
  ['comment', value => '<!--' + value + '-->'],
  ['template', value => '<template>' + value + '</template>'],
  ['script', value => '<script type="text/plain">' + value + '</script>'],
]) {
  test('an inactive ' + label + ' role-list copy cannot replace the real six observations', async () => {
    const decoy = wrap('<h2>Roles We\'re Hiring For</h2><ul><li>Wrong India Role</li></ul>')
    const { jobs } = await collect(original.replace('<body', decoy + '<body'))
    assert.equal(jobs.length, 6)
    assert.equal(jobs.some(job => job.title === 'Wrong India Role'), false)
  })
}

test('a hidden role cannot become an active hiring observation', async () => {
  const { jobs } = await collect(original.replace('<li>BPO Workflow Manager', '<li hidden>BPO Workflow Manager'))
  assert.equal(jobs.length, 5)
  assert.equal(jobs.some(job => job.title.startsWith('BPO Workflow Manager')), false)
})

test('ambiguous active role headings fail as a coverage gap', async () => {
  const changed = original.replace('<body', '<h2>Roles We\'re Hiring For</h2><ul><li>Wrong Role</li></ul><body')
  await assert.rejects(collect(changed), error => error.code === 'SELECTSYS_COVERAGE_GAP')
})

test('an office India label and a Remote title do not supply a role-owned country', async () => {
  const { jobs } = await collect(original.replace('Hyderabad, India', 'Hyderabad, India - corporate head office'))
  assert.equal(jobs.every(job => job.country === null && !isIndiaJob(job)), true)
})

test('a missing role list does not certify a verified empty source', async () => {
  const changed = original.replace(/<li>BPO Workflow Manager[\s\S]*?<\/ul>/, '</ul>')
  await assert.rejects(collect(changed), error => error.code === 'SELECTSYS_COVERAGE_GAP')
})

for (const metadata of [{ status: 403, url: CAREERS_URL }, { status: 200, url: 'https://www.selectsys.com/' }]) {
  test('wrong status/final URL cannot qualify a retained matching HTML body: ' + metadata.status + '/' + metadata.url, async () => {
    await assert.rejects(collect({ html: original, ...metadata }), error => error.code === 'SELECTSYS_COVERAGE_GAP')
  })
}

test('abort before entry prevents a network request', async () => {
  const controller = new AbortController(), reason = Error('Stop before entry');controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => { assert.fail('Aborted call must not request HTML') } }), error => error === reason)
})

test('abort during transport propagates unchanged', async () => {
  const controller = new AbortController(), reason = Error('Stop while fetching')
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => { controller.abort(reason);return original } }), error => error === reason)
})

test('audit callback failure propagates', async () => {
  const reason = Error('Audit consumer failed')
  await assert.rejects(collect(original, { onAudit: () => { throw reason } }), error => error === reason)
})
