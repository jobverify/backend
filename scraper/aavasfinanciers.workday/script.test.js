import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readNativeDocument, activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const root = 'https://www.aavas.in'
const career = root + '/career'
const listing = root + '/join-our-team'
const technical = root + '/job-description/NzU1/MTUw'
const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
const options = f => {
  let listingReads = 0
  return { now: () => f.capturedAt, fetchPage: async url => {
    if (url === career) return f.career
    if (url === listing) return ++listingReads === 1 ? f.first : f.last
    if (url === f.client.finalUrl) return f.client
    assert.ok(Object.hasOwn(f.roles, url), 'Unobserved current native role ' + url)
    return f.roles[url]
  } }
}
const changeBranchSchema = (f, change) => {
  const state = readNativeDocument(f.first.html).nodes(n => n.tag === 'select' && n.attrs.name === 'locationState[]')[0]
  const callback = state.attrs.onchange
  const rows = JSON.parse(callback.slice(callback.indexOf('['), callback.lastIndexOf(']') + 1))
  const branch = rows.find(row => row.branch_schema)
  const schema = JSON.parse(activeScripts(branch.branch_schema)[0])
  change(schema)
  branch.branch_schema = '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>'
  const value = ('handleChangeStateJoinTeam(this.selectedOptions,3,' + JSON.stringify(rows) + ')')
    .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const at = f.first.html.indexOf('name="locationState[]"'), start = f.first.html.lastIndexOf('<select', at)
  const end = f.first.html.indexOf('</select>', at) + '</select>'.length
  f.first.html = f.first.html.slice(0, start) + '<select name="locationState[]" id="multiSelectState" multiple onchange="' + value + '"><option value="10">Punjab</option><option value="15">Chandigarh</option></select>' + f.first.html.slice(end)
}

test('Aavas extracts eight exact native profiles with workplace-state/country proof and full descriptions while dates and whole-company counts remain unknown', async () => {
  const jobs = await run(options(fixture()))
  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['752', '753', '754', '755', '757', '759', '760', '761'])
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.company, 'Aavas Financiers')
    assert.ok(job.sourceDescription.length > 500)
    assert.ok(job.jobDescription.length > 200)
    assert.ok(job.minExperience >= 0 && job.maxExperience >= job.minExperience)
    assert.equal(job.postingDate, null, 'Branch created/modified timestamps are not publication dates')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceUrl, job.applyUrl)
    assert.ok(job.nativeWorkplaceStates.length > 0)
    assert.ok(job.nativeLocationProof)
  }
  const vasai = jobs.find(job => job.jobId === '755')
  assert.equal(vasai.city, 'VASAI')
  assert.equal(vasai.state, 'Maharashtra')
  const punjab = jobs.find(job => job.jobId === '757')
  assert.equal(punjab.city, null, 'Multiple native cities are not replaced by a state label')
  assert.deepEqual(punjab.nativeWorkplaceStates, ['Punjab', 'Chandigarh'])
  assert.match(punjab.nativeLocationProof.method, /branch.*country/i)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
})

for (const [name, change] of [
  ['inactive official career delegation', f => { f.career.html = '<object data="/existing.pdf"><a href="https://www.aavas.in/join-our-team">View Open Positions</a></object>' }],
  ['wrong first-party final URL', f => { f.first.finalUrl = 'https://unrelated.example/jobs' }],
  ['unsupported workplace state', f => { f.first.html = f.first.html.replace('value="Maharashtra"', 'value="Ontario"') }],
  ['workplace state removed despite a matching headquarters label', f => { f.first.html = f.first.html.replace(/<input\b[^>]*name="group_id"[^>]*value="Maharashtra"[^>]*>/, '') + '<div>Corporate headquarters: Maharashtra, India</div>' }],
  ['changed native selector route contract', f => { f.client.html = f.client.html.replace('`/job-description/${l}/${i}`', '`/unreviewed/${l}/${i}`') }],
  ['repeated current native profile ID', f => { assert.ok(f.first.html.includes('NzYw')); f.first.html = f.first.html.replace('NzYw', 'NzYx') }],
  ['different native profile canonical ID', f => { f.roles[technical].html = f.roles[technical].html.replace('href="' + technical + '"', 'href="' + technical.replace('/NzU1/', '/NzU0/') + '"') }],
  ['different native role title', f => { f.roles[technical].html = f.roles[technical].html.replace('Technical Executive', 'Different Native Role') }],
  ['different native role city', f => { f.roles[technical].html = f.roles[technical].html.replace('> VASAI<', '> London<') }],
  ['missing active responsibilities', f => { f.roles[technical].html = f.roles[technical].html.replace(/(<h6[^>]*>Description<\/h6>)[\s\S]*?(<h6[^>]*>Desired Skills<\/h6>)/, '$1<template>Only inactive role content</template>$2') }],
  ['changed final profile inventory', f => { assert.ok(f.last.html.includes('NzUy')); f.last.html = f.last.html.replace('NzUy', 'NzUx') }],
]) test('Aavas refuses ' + name + ' without fabricating a complete inventory', async () => {
  const f = fixture(); change(f)
  await assert.rejects(run(options(f)))
})

for (const [name, change] of [
  ['a foreign branch country', schema => { schema.address.addressCountry = 'US' }],
  ['an unsupported branch country object', schema => { schema.address.addressCountry = { identifier: 'IN' } }],
  ['a contradictory branch city', schema => { schema.address.addressLocality = 'Boston' }],
  ['a contradictory branch state', schema => { schema.address.addressRegion = 'Ontario' }],
]) test('Aavas exact native state selector rejects ' + name, async () => {
  const f = fixture(); changeBranchSchema(f, change)
  await assert.rejects(run(options(f)), /native branch country\/city\/state schema conflict/)
})

test('native branch metadata survives equivalent attribute encoding before country-conflict mutations', async () => {
  const f = fixture(); changeBranchSchema(f, () => {})
  assert.equal((await run(options(f))).length, 8)
})

test('Aavas honors cancellation at an awaited response boundary and refuses caller caps', async () => {
  const f = fixture(), controller = new AbortController(), reason = new Error('cancel Aavas after career response')
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { requests++; controller.abort(reason); return f.career } }), error => error === reason)
  assert.equal(requests, 1)
  await assert.rejects(run({ ...options(f), maxJobs: 1 }), /cap|limit/i)
})

test('Aavas default transport preserves a blocked stage without reading the rejected response body', async t => {
  let reads = 0, cancellations = 0
  t.mock.method(globalThis, 'fetch', async () => ({ status: 403, url: career,
    body: { cancel: async () => { cancellations++ } }, text: async () => { reads++; return '<title>Forbidden</title>' } }))
  await assert.rejects(run(), error => error.status === 403 && error.stage === 'official-careers'
    && error.finalUrl === career && error.softFailure === true && error.failureKind === 'blocked_or_access_denied')
  assert.equal(reads, 0)
  assert.equal(cancellations, 1)
})
