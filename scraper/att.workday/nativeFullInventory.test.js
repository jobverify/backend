import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {inspectAttSearch, parseAttPage, parseAttDetail} from './nativeContract.js'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'

const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261025/full-native-44.json.gz', import.meta.url))))
const expected = JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261025/full-native-roles.json', import.meta.url)))
const packet = name => {
  const record = packets.find(item => item.name === name)
  assert.ok(record, `Missing captured native packet ${name}`)
  return record
}
const rows = [
  ...inspectAttSearch(packet('att-india5').body).rows,
  ...parseAttPage(packet('att-india-page2-64k').body, {page: 2, total: 36}).rows,
  ...parseAttPage(packet('att-india-page3-64k').body, {page: 3, total: 36}).rows,
]
const now = '2026-10-25T18:10:00.000Z'
const rowFor = id => {
  const row = rows.find(item => item.id === id)
  assert.ok(row, `Missing captured native India row ${id}`)
  return row
}
const bodyFor = id => packet(`att-detail-${id}`).body

function posting(body) {
  const models = [...body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]))
  const jobs = models.filter(model => model['@type'] === 'JobPosting')
  assert.equal(jobs.length, 1)
  return jobs[0]
}
function changePosting(body, change) {
  let count = 0
  const result = body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi, (all, start, json, end) => {
    const value = JSON.parse(json)
    if (value['@type'] !== 'JobPosting') return all
    count++
    change(value)
    return start + JSON.stringify(value) + end
  })
  assert.equal(count, 1)
  return result
}
function replace(body, before, after) {
  assert.ok(body.includes(before), `Missing captured mutation anchor ${before}`)
  return body.replaceAll(before, after)
}

for (const role of expected) {
  test(`captured AT&T role ${role.nativeJobId} preserves ${role.req} and its native application binding`, () => {
    const body = bodyFor(role.nativeJobId)
    const model = posting(body)
    const row = rowFor(role.nativeJobId)
    const job = parseAttDetail(body, row, {now})
    assert.equal(job.nativeJobId, role.nativeJobId)
    assert.equal(job.jobId, role.req)
    assert.equal(job.nativeRequisitionId, role.req)
    assert.equal(job.title, role.schemaTitle)
    assert.equal(job.sourceUrl, role.schemaUrl)
    assert.equal(job.nativeEmployer, 'AT&T')
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.country, 'India')
    assert.equal(job.city, row.city)
    assert.equal(job.location, row.location)
    assert.deepEqual(job.nativeAddresses, model.jobLocation.map(item => item.address))
    assert.equal(job.nativeLocationMetadata, role.locationMetadata)
    assert.equal(job.nativePublicationDate, role.datePosted)
    assert.equal(job.postedAt, role.datePosted + 'T00:00:00.000Z')
    assert.equal(job.sourcePostingDateIsExact, false)
    assert.equal(job.postingDatePrecision, 'day')
    assert.equal(job.nativeStructuredDescription, model.description)
    assert.ok(job.nativeVisibleDescription.length > 100)
    assert.equal(job.sourceDetailComplete, true)
    assert.ok(job.sourceDescription.length > 100)
    assert.equal(job.jobDescription, job.sourceDescription)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.nativeValidThrough, role.validThrough)
    assert.equal(job.closingDate, null)
    assert.equal(job.sourceLifecycleComplete, false)
    const applicationReq = /_(R-[^/]+)\/apply$/.exec(job.applyUrl)
    assert.ok(applicationReq)
    assert.equal(applicationReq[1], role.applySuffix)
  })
}

test('the captured public AT&T runtime reconciles all 36 roles and all three closing listing pages', async () => {
  const responses = new Map()
  for (const record of packets) {
    assert.equal(Buffer.byteLength(record.body), record.bytes, record.name)
    assert.equal(createHash('sha256').update(record.body).digest('hex'), record.sha256, record.name)
    const queue = responses.get(record.url) ?? []
    queue.push(record)
    responses.set(record.url, queue)
  }
  let calls = 0
  const jobs = await run({now, fetch: async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    const queue = responses.get(url)
    assert.ok(queue?.length, 'Unexpected native request')
    const response = queue.shift()
    calls++
    return {status: response.status, url: response.finalUrl, text: async () => response.body}
  }})
  assert.equal(calls, 44)
  assert.equal(jobs.length, 36)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 36)
  assert.equal(new Set(jobs.map(job => job.nativeJobId)).size, 36)
  assert.equal([...responses.values()].every(queue => queue.length === 0), true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 36)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 36)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [name, id, change] of [
  ['foreign structured country', '97125467648', body => changePosting(body, model => { model.jobLocation[0].address.addressCountry = 'United States' })],
  ['different structured city', '97125467648', body => changePosting(body, model => { model.jobLocation[0].address.addressLocality = 'Hyderabad' })],
  ['different native metadata city', '97125467648', body => replace(body, 'Bengaluru~Karnataka~India', 'Mumbai~Maharashtra~India')],
  ['foreign employer on a suffixed role', '97125467664', body => changePosting(body, model => { model.hiringOrganization.name = 'Other Telecom' })],
  ['different structured title on a suffixed role', '97125467664', body => changePosting(body, model => { model.title = 'Unrelated Firmware Role' })],
  ['different requisition family', '97125467664', body => changePosting(body, model => { model.identifier.value = 'R-999999-1' })],
  ['different native requisition metadata', '97125467664', body => replace(body, 'name="job-ats-req-id" content="R-113447-1"', 'name="job-ats-req-id" content="R-113447"')],
  ['different application requisition prefix', '97125467648', body => replace(body, '_R-113447-1/apply', '_R-1134471/apply')],
  ['unproven application suffix two', '97125467648', body => replace(body, '_R-113447-1/apply', '_R-113447-2/apply')],
  ['stacked application suffixes', '97125467664', body => replace(body, '_R-113447-1/apply', '_R-113447-1-1/apply')],
  ['different application route', '97125467664', body => replace(body, 'ATTGeneral/job/', 'ATTGeneral/positions/')],
  ['wrong native public ID', '97125467664', body => replace(body, 'data-job-id="97125467664"', 'data-job-id="99999999999"')],
  ['inactive application controls', '97125467664', body => replace(body, 'class="button job-apply', 'inert class="button job-apply')],
  ['foreign metadata country when schema country is blank', '102237342704', body => replace(body, 'Bengaluru~Karnataka~India', 'Bengaluru~Karnataka~United States')],
  ['conflicting schema country replacing its native blank', '102237342704', body => changePosting(body, model => { model.jobLocation[0].address.addressCountry = 'United States' })],
  ['null schema country replacing its native blank', '102237342704', body => changePosting(body, model => { model.jobLocation[0].address.addressCountry = null })],
  ['wrong schema city when native country is blank', '102237342704', body => changePosting(body, model => { model.jobLocation[0].address.addressLocality = 'Mumbai' })],
]) {
  test(`the observed AT&T req/city variants still reject ${name}`, () => {
    assert.throws(() => parseAttDetail(change(bodyFor(id)), rowFor(id), {now}), /AT&T native/i)
  })
}

function assertCurrentRoleUnavailable(body, row) {
  let job
  try { job = parseAttDetail(body, row, {now}) }
  catch (failure) { assert.match(failure.message, /AT&T native/i); return }
  assert.equal(analyzePublishableJobs([job], {now}).eligibleJobs.length, 0)
}

test('one unavailable native role is excluded while the remaining India inventory is recovered as partial', async () => {
  const {run} = await import('./script.js')
  const victim = '101071794848', responses = new Map(packets.map(record => [record.url, record.body]))
  responses.set(rowFor(victim).url, replace(bodyFor(victim), '<div class="ats-description">', '<div hidden class="ats-description">'))
  const jobs = await run({now, fetch: async url => {
    assert.ok(responses.has(url), `Unexpected native request ${url}`)
    return {status: 200, url, text: async () => responses.get(url)}
  }})
  assert.equal(jobs.length, 35)
  assert.ok(jobs.every(job => job.nativeJobId !== victim && job.sourceDetailComplete === true))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /unqualified-native-details/)
})

test('a bound active native closure notice cannot become publication eligible through an empty JD', () => {
  const id = '101071794848'
  const row = rowFor(id)
  const original = bodyFor(id)
  const valid = parseAttDetail(original, row, {now})
  assert.equal(analyzePublishableJobs([valid], {now}).eligibleJobs.length, 1)
  const notice = '<p>This position is closed.</p>'
  const structured = changePosting(original, model => { model.description = notice + model.description })
  const closed = replace(structured, '<div class="ats-description">', '<div class="ats-description">' + notice)
  assertCurrentRoleUnavailable(closed, row)
})

test('a hidden full native role description cannot become publication eligible through its JSON-LD copy', () => {
  const id = '101071794848'
  const row = rowFor(id)
  const original = bodyFor(id)
  assert.equal(analyzePublishableJobs([parseAttDetail(original, row, {now})], {now}).eligibleJobs.length, 1)
  assertCurrentRoleUnavailable(replace(original, '<div class="ats-description">', '<div hidden class="ats-description">'), row)
})

test('instruction-only native descriptions cannot become publication eligible as current full roles', () => {
  const id = '101071794848'
  const row = rowFor(id)
  const original = bodyFor(id)
  assert.equal(analyzePublishableJobs([parseAttDetail(original, row, {now})], {now}).eligibleJobs.length, 1)
  const unavailable = '<p>The full job description is unavailable. Please check back later for details.</p>'
  let changed = changePosting(original, model => { model.description = unavailable })
  changed = changed.replace(/(<div class="ats-description">)[\s\S]*?(<span class="job-id job-info">)/, '$1' + unavailable + '$2')
  assertCurrentRoleUnavailable(changed, row)
})
