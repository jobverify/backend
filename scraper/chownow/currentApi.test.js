import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const API = 'https://api.lever.co/v0/postings/chownow?mode=json'
const original = () => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-api-20261113.json.gz', import.meta.url))))
const execute = async (t, change = data => data, options = {}) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push(url)
    assert.equal(init.method || 'GET', 'GET')
    const payload = url === API ? JSON.stringify(change(original(), calls.length)) : '<title>ChowNow Careers</title>'
    const response = new Response(payload, { headers: { 'content-type': url === API ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return { jobs: await run(options), calls }
}

test('ChowNow reads its reviewed native Lever API twice and retains all seven original records without a company zero claim', async t => {
  const { jobs, calls } = await execute(t)
  assert.deepEqual(calls, [API, API])
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativeRecords, original())
  assert.equal(readSourceObservationEvidence(jobs, 'chownow').observedVacancyCount, 7)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('ChowNow maps a future native India role and preserves every original description section', async t => {
  const { jobs } = await execute(t, rows => {
    Object.assign(rows[0], { country: 'IN', categories: { ...rows[0].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
    return rows
  })
  assert.equal(jobs.length, 1)
  const record = original()[0]
  assert.equal(jobs[0].jobId, record.id)
  assert.equal(jobs[0].country, 'India')
  assert.ok(jobs[0].sourceDescription.includes(record.descriptionBody))
  assert.ok(record.lists.every(section => jobs[0].sourceDescription.includes(section.content)))
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('ChowNow rejects hidden authored criteria even when generated section headings remain visible', async t => {
  await assert.rejects(execute(t, rows => {
    Object.assign(rows[0], { country: 'IN', categories: { ...rows[0].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
    rows[0].descriptionBody = '<div hidden>' + rows[0].descriptionBody + '</div>'
    rows[0].lists = rows[0].lists.map(section => ({ ...section, content: '<div hidden>' + section.content + '</div>' }))
    return rows
  }), /criteria.*hidden|active full role criteria missing/)
})

for (const [label, hide] of [
  ['a hidden criteria list alongside a visible role body', row => { row.lists[0].content = '<div hidden>' + row.lists[0].content + '</div>' }],
  ['a hidden role body alongside visible criteria lists and plain fallback', row => { row.descriptionBody = '<div hidden>' + row.descriptionBody + '</div>' }],
]) test('ChowNow rejects ' + label, async t => {
  await assert.rejects(execute(t, rows => {
    Object.assign(rows[0], { country: 'IN', categories: { ...rows[0].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
    hide(rows[0])
    return rows
  }), /criteria.*hidden|active full role criteria missing/)
})

for (const [label, change] of [
  ['foreign native identity', rows => { rows[0].hostedUrl = rows[0].hostedUrl.replace('/chownow/', '/other/'); return rows }],
  ['contradictory country', rows => { rows[0].categories.location = 'Bengaluru, India'; return rows }],
  ['missing full criteria', rows => { Object.assign(rows[0], { opening: '', openingPlain: '', description: '', descriptionPlain: '', descriptionBody: '', descriptionBodyPlain: '', lists: [], additional: '', additionalPlain: '' }); return rows }],
  ['hidden-only criteria', rows => { Object.assign(rows[0], { opening: '', openingPlain: '', description: '', descriptionPlain: '', descriptionBody: '<div hidden>Build and maintain restaurant technology services and reliable customer integrations.</div>', descriptionBodyPlain: '', lists: [], additional: '', additionalPlain: '' }); return rows }],
  ['closing cohort drift', (rows, read) => read === 2 ? rows.slice(1) : rows],
]) test('ChowNow rejects ' + label + ' without producing an empty success', async t => {
  await assert.rejects(execute(t, change))
})

test('ChowNow honors cancellation before any native read', async t => {
  const controller = new AbortController(); controller.abort(Error('stop current ChowNow'))
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled native source must not fetch'))
  await assert.rejects(run({ signal: controller.signal }), /stop current ChowNow/)
})

test('ChowNow rejects a JSON-looking response with a foreign MIME type', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const response = new Response(JSON.stringify(original()), { headers: { 'content-type': 'text/plain' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  })
  await assert.rejects(run(), /MIME/)
})

test('ChowNow bounds a native transport that ignores cancellation', async t => {
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}))
  await assert.rejects(run({ timeoutMs: 20 }), /timeout|abort/i)
})
