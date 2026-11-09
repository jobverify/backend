import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { declaredJibeSearch, readJibeRecruitment } from '../scraper-support/utils/recruitmentJibe.js'
import { run as runRegisteredSource } from '../scraper/bookingholdings/script.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentJibeScope20261107/current-declared-scope.json.gz', import.meta.url))))
const bodies = new Map(fixture.records.map(row => {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(bytes.length, row.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256)
  return [row.artifact, bytes.toString('utf8')]
}))
const boardURL = 'https://www.bookingholdings-coe.com/bookingholdings-coe/jobs'
const board = bodies.get('coe-jobs.body')
const client = bodies.get('coe-declared-search-client.body')
const scope = { internal: 'false', tags1: 'Booking Holdings COE Company Hierarchy' }
const actualPayload = JSON.parse(bodies.get('scoped-native-detail/response-1.bin'))
const actualDetail = JSON.parse(bodies.get('scoped-native-detail/response-2.bin'))
const actualRow = actualPayload.jobs.find(({ data }) => data.req_id === actualDetail.req_id)
assert.ok(actualRow)
function currentSearch(html = board) { return declaredJibeSearch(readNativeDocument(html), boardURL) }
function changedOverride(value) {
  return board.replace('"searchOverride":{"tags1":"Booking Holdings COE Company Hierarchy"}', '"searchOverride":' + JSON.stringify(value))
}
async function replay({ row = actualRow, detail = actualDetail, search = currentSearch(), script = client } = {}) {
  const calls = [], jobs = [], retained = [], issues = [], inventories = []
  await readJibeRecruitment(search, {
    readRenderer: async () => ({ html: script }), permit: () => {}, maxPages: 1, maxDetails: 1, canRead: () => true,
    inventoryRead: value => inventories.push(value), recordRead: value => retained.push(value), unresolved: value => issues.push(value),
    problem: (_stage, error) => { throw error }, addJob: value => jobs.push(value),
    readJson: async url => {
      calls.push(url)
      return new URL(url).pathname === '/api/jobs' ? { jobs: [row], count: 1, totalCount: 1 } : detail
    },
  })
  return { calls, jobs, retained, issues, inventories }
}

test('the original current board preserves its complete anonymous COE search scope', () => {
  const search = currentSearch()
  assert.equal(search.cid, 'workingatbooking')
  assert.equal(search.context, 'bookingholdings-coe')
  assert.deepEqual(search.mandatoryParams, scope)
})

test('every actual COE candidate query carries the declared hierarchy and publication selector', async () => {
  const { calls, jobs } = await replay()
  const query = new URL(calls[0])
  for (const [key, value] of Object.entries(scope)) assert.equal(query.searchParams.get(key), value)
  assert.equal(query.searchParams.get('country'), 'India')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].description, actualDetail.description)
  assert.equal(jobs[0].record.detail.country_code, 'IN')
  assert.equal(jobs[0].record.detail.hiring_organization, 'Booking Holdings')
})

for (const [label, value] of [
  ['unknown field', { tags1: scope.tags1, otherTenant: 'other' }],
  ['non-scalar hierarchy', { tags1: [scope.tags1] }],
  ['internal publication', { tags1: scope.tags1, internal: true }],
  ['null publication selector', { tags1: scope.tags1, internal: null }],
  ['country override', { tags1: scope.tags1, country: 'United States' }],
  ['query parameter collision', { tags1: scope.tags1, limit: 100 }],
  ['empty hierarchy', { tags1: '' }],
]) test('an unsupported own search override stays unqualified: ' + label, () => {
  assert.throws(() => currentSearch(changedOverride(value)), /scope|override|hierarchy|internal/i)
})

test('an unmatched current context cannot silently discard a different native hierarchy', () => {
  assert.throws(() => currentSearch(changedOverride({ tags1: 'Another Company Hierarchy' })), /scope|context|hierarchy/i)
})

for (const [label, tags1] of [
  ['missing', undefined], ['another brand', ['Another Company Hierarchy']],
  ['partly unknown array', [scope.tags1, {}]], ['scalar', scope.tags1],
]) test('a native listing with ' + label + ' hierarchy is observed and held', async () => {
  const row = structuredClone(actualRow)
  row.data.tags1 = tags1
  const { jobs, retained, issues, calls } = await replay({ row })
  assert.equal(jobs.length, 0)
  assert.equal(retained.length, 1)
  assert.deepEqual(retained[0], row.data)
  assert.ok(issues.includes('native-jibe-context-scope-unqualified'))
  assert.equal(calls.length, 1)
})

test('an own listing cannot donate its hierarchy to a conflicting full detail', async () => {
  const detail = { ...actualDetail, tags1: ['Another Company Hierarchy'] }
  const { jobs, retained, issues } = await replay({ detail })
  assert.equal(jobs.length, 0)
  assert.equal(retained.length, 1)
  assert.ok(issues.includes('native-jibe-context-scope-unqualified'))
})

test('a held scope conflict preserves the complete native row and detail on its retained inventory audit', async () => {
  const detail = { ...actualDetail, tags1: ['Another Company Hierarchy'] }
  const { jobs, inventories } = await replay({ detail })
  assert.equal(jobs.length, 0)
  const held = inventories[0].heldNativeRows?.[0]
  assert.ok(held, 'A context conflict must keep full native models for later assessment')
  assert.equal(held.reason, 'native-jibe-context-scope-unqualified')
  assert.deepEqual(held.nativeRow, actualRow)
  assert.deepEqual(held.nativeDetail, detail)
  assert.deepEqual(held.mandatoryParams, scope)
})

test('a changed scoped publisher program is rejected before any API read', async () => {
  let calls = 0
  await assert.rejects(readJibeRecruitment(currentSearch(), {
    permit: () => {}, readRenderer: async () => ({ html: client.replace('searchOverride?.internal||"false"', 'searchOverride?.internal||"true"') }),
    readJson: () => { calls++; throw Error('Changed scope cannot authorize a native query') },
    maxPages: 1, maxDetails: 1, canRead: () => true,
  }), /client|scope|program/i)
  assert.equal(calls, 0)
})

test('the registered Booking Holdings export reaches the declared COE inventory within its page budget', async () => {
  const calls = []
  const jobs = await runRegisteredSource({
    now: () => '2026-11-06T21:40:00.000Z', maxPages: 1, maxDetails: 1,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input))
      calls.push(url.href)
      assert.equal(init.credentials, 'omit')
      let body, type = 'text/html'
      if (url.href === boardURL) body = board
      else if (url.origin === 'https://www.bookingholdings.com' && url.pathname === '/careers/careers/') body = bodies.get('corporate.body')
      else if (url.href === 'https://app.jibecdn.com/prod/search/4.11.225/main.js') { body = client; type = 'application/javascript' }
      else if (url.origin === new URL(boardURL).origin && url.pathname === '/api/jobs') {
        for (const [name, value] of Object.entries(scope)) assert.equal(url.searchParams.get(name), value)
        assert.equal(url.searchParams.get('country'), 'India')
        body = bodies.get('scoped-native-detail/response-1.bin'); type = 'application/json'
      } else if (url.origin === new URL(boardURL).origin && url.pathname === '/api/jobs/30579/en-us') {
        body = bodies.get('scoped-native-detail/response-2.bin'); type = 'application/json'
      } else assert.fail('Only exact retained current declarations may run: ' + url.href)
      const response = new Response(body, { status: 200, headers: { 'content-type': type } })
      Object.defineProperty(response, 'url', { value: url.href })
      return response
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '30579')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].nativeHiringOrganization.name, 'Booking Holdings')
  assert.deepEqual(jobs[0].nativeSourceRecord.detail, actualDetail)
  assert.equal(jobs[0].sourceDescription, actualDetail.description)
  assert.equal(jobs[0].postingDate, actualDetail.posted_date)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(calls.length, 4)
})
