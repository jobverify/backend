import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { OFFICIAL_ATS_DISCOVERY } from '../scraper-support/utils/officialAtsRecovery.js'
import { resolveZeroJobOutcome } from '../scraper-support/runner.js'

const folder = new URL('../scraper/censys/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipts = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const apiURL = 'https://boards-api.greenhouse.io/v1/boards/censys/jobs?content=true'
const native = JSON.parse(receipts.find(row => row.requestedURL === apiURL).body)
const role = native.jobs[0]
assert.equal(native.jobs.length, 26)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'censys')).run(options)
const replay = (t, mutate) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    calls.push(url)
    assert.equal(init.method || 'GET', 'GET')
    const row = receipts.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured live HTTP is forbidden: ' + url)
    const current = mutate ? mutate({ ...row, body: Buffer.from(row.body) }) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
const withIndiaRole = row => {
  if (row.requestedURL !== apiURL) return row
  const payload = JSON.parse(row.body)
  Object.assign(payload.jobs[0], { location: { name: 'Bengaluru, India' }, offices: [],
    metadata: [{ name: 'Country', value: 'India' }] })
  return { ...row, body: Buffer.from(JSON.stringify(payload)) }
}

test('registered Censys reads the published native 26-role feed through its malformed corporate page', async t => {
  const calls = replay(t)
  const jobs = await run()
  assert.deepEqual(calls, [manifest.provider.companyCareerPage, apiURL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 26)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY]?.boards[0].boardToken, 'censys')
  assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
  assert.equal(getScraperCatalog().find(row => row.source === 'censys').backfillMode, 'live-parser')
})

test('registered Censys retains a native India role with full original content and its publication timestamp', async t => {
  replay(t, withIndiaRole)
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(String(jobs[0].jobId), String(role.id))
  assert.equal(jobs[0].title, role.title)
  assert.equal(jobs[0].company, 'Censys')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].nativeDescriptionRaw, role.content)
  assert.equal(jobs[0].nativeSourceRecord.content, role.content)
  assert.match(jobs[0].sourceDescription, /^<div class="content-intro">/)
  assert.equal(jobs[0].sourceDescription, jobs[0].jobDescription)
  assert.equal(new Date(jobs[0].postingDate).getTime(), new Date(role.first_published).getTime())
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const changed of ['employer', 'country', 'posting account', 'posting identity', 'inventory envelope']) test('Censys rejects a native ' + changed + ' contradiction', async t => {
  replay(t, row => {
    if (row.requestedURL !== apiURL) return row
    const payload = JSON.parse(withIndiaRole(row).body)
    if (changed === 'employer') payload.jobs[0].company_name = 'Unrelated Employer'
    else if (changed === 'country') payload.jobs[0].metadata = [{ name: 'Country', value: 'United States' }]
    else if (changed === 'posting account') payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/unrelated/jobs/' + role.id
    else if (changed === 'posting identity') payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/censys/jobs/999999'
    else { payload.success = false; payload.error = 'Unavailable'; payload.jobs = [] }
    return { ...row, body: Buffer.from(JSON.stringify(payload)) }
  })
  await assert.rejects(run())
})

for (const [label, url] of [
  ['repeated embed token', `https://boards.greenhouse.io/embed/job_app?for=censys&token=${role.id}&token=999999`],
  ['reversed embed token', `https://boards.greenhouse.io/embed/job_app?for=censys&token=999999&token=${role.id}`],
  ['repeated canonical query id', `${role.absolute_url}?gh_jid=${role.id}&gh_jid=999999`],
  ['reversed canonical query id', `${role.absolute_url}?gh_jid=999999&gh_jid=${role.id}`],
  ['repeated embed account', `https://boards.greenhouse.io/embed/job_app?for=censys&for=unrelated&token=${role.id}`],
  ['path and token disagreement', `${role.absolute_url}?token=999999`],
  ['first-party repeated query id', `https://censys.com/careers/native-role?gh_jid=${role.id}&gh_jid=999999`],
]) test('Censys rejects contradictory native URL identity: ' + label, async t => {
  replay(t, row => {
    if (row.requestedURL !== apiURL) return row
    const payload = JSON.parse(withIndiaRole(row).body)
    payload.jobs[0].absolute_url = url
    return { ...row, body: Buffer.from(JSON.stringify(payload)) }
  })
  await assert.rejects(run(), /identity|account/)
})

for (const typedId of [role.id, String(role.id)]) test('Censys rejects duplicate normalized native IDs with conflicting descriptions: ' + typeof typedId, async t => {
  replay(t, row => {
    if (row.requestedURL !== apiURL) return row
    const payload = JSON.parse(withIndiaRole(row).body)
    payload.jobs.push({ ...payload.jobs[0], id: typedId, title: 'A different native role', content: '<p>Different original content</p>' })
    payload.meta.total++
    return { ...row, body: Buffer.from(JSON.stringify(payload)) }
  })
  await assert.rejects(run(), /duplicate.*identity/i)
})

test('Censys does not query any native account after the corporate handoff disappears', async t => {
  const calls = replay(t, row => row.requestedURL !== apiURL
    ? { ...row, body: Buffer.from('<html><body>Censys careers. No current job board.</body></html>') } : row)
  await assert.rejects(run(), /binding|supported-ats/)
  assert.ok(calls.every(url => /(?:^|\.)censys\.com$/.test(new URL(url).hostname)))
})

test('Censys preserves first publication when the native edit timestamp changes', async t => {
  replay(t, row => {
    if (row.requestedURL !== apiURL) return row
    const payload = JSON.parse(withIndiaRole(row).body)
    payload.jobs[0].updated_at = '2099-01-01T00:00:00Z'
    return { ...row, body: Buffer.from(JSON.stringify(payload)) }
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(new Date(jobs[0].postingDate).getTime(), new Date(role.first_published).getTime())
})

test('Censys honors cancellation before any request', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled extraction must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('Cancelled Censys source'))
  await assert.rejects(run({ signal: controller.signal }), /Cancelled Censys source/)
})
