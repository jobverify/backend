import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runNativeInventory } from './native.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-role-94165.json', import.meta.url), 'utf8'))
const packets = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-native-packets.json', import.meta.url), 'utf8'))
const root = 'https://algoworks.keka.com/careers/'
const id = 'c1623220-7738-4bff-ba91-5a9f0bbe01fc'
const active = root + 'api/embedjobs/default/active/' + id
const board = root + 'api/jobs/default/active'
const detail = packets[root + 'jobdetails/94165']
const exercise = async ({ job = structuredClone(native), override, ...options } = {}) => {
  const calls = [], counts = new Map()
  const jobs = await runNativeInventory({ ...options, fetchImpl: async url => {
    calls.push(url)
    counts.set(url, (counts.get(url) || 0) + 1)
    let body = packets[url]
    if (url === active || url === board) body = JSON.stringify([job])
    if (url === root + 'api/embedjobs/grouplinkstatus/' + id) body = '{"isGroupLinked":false}'
    if (url === root + 'jobdetails/' + job.id) body = detail.replaceAll('94165', String(job.id)).replaceAll(native.title, job.title).replaceAll(native.description, job.description)
    assert.equal(typeof body, 'string', 'Unexpected native URL: ' + url)
    const packet = override?.({ url, body, count: counts.get(url) }) || { body, status: 200 }
    const response = new Response(packet.body, { status: packet.status || 200 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  } })
  return { jobs, calls }
}

test('Algoworks derives the current explicit India remote header and reconciles the complete native scope', async () => {
  const { jobs, calls } = await exercise()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '94165')
  assert.equal(jobs[0].title, 'Automation Quality Analyst')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Remote')
  assert.equal(jobs[0].location, 'India, Remote')
  assert.equal(jobs[0].postingDate, '2026-10-30T05:40:33.233Z')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceCountryEvidence.kind, 'explicit-native-role-workplace-header')
  assert.equal(jobs[0].sourceCountryEvidence.nativeLocation, 'India, Remote')
  assert.match(jobs[0].jobDescription, /Cypress/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(calls.filter(url => url === active).length, 2)
  assert.equal(calls.filter(url => url === board).length, 2)
})

test('Algoworks supports another native role with the same explicit role-owned workplace format', async () => {
  const job = { ...structuredClone(native), id: 94167, title: 'API Quality Analyst', description: native.description.replaceAll(native.title, 'API Quality Analyst') }
  const { jobs } = await exercise({ job })
  assert.equal(jobs[0].jobId, '94167')
  assert.equal(jobs[0].title, 'API Quality Analyst')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Remote')
})

for (const [label, change] of [
  ['missing country', description => description.replace('Location: India, Remote', 'Location: Remote')],
  ['foreign country', description => description.replace('Location: India, Remote', 'Location: United States, Remote')],
  ['unknown city without country', description => description.replace('Location: India, Remote', 'Location: Noida')],
  ['different role header', description => description.replace('Role:</strong> Automation Quality Analyst', 'Role:</strong> Different Analyst')],
  ['duplicate workplace', description => description + '<div>Location: India, Remote</div>'],
  ['contradictory workplace', description => description + '<div>Work Location: United States</div>'],
  ['hidden header', description => description.replace('<strong>Location:', '<strong hidden>Location:')],
  ['template-only header', description => '<template>' + description + '</template>'],
]) test('Algoworks refuses role geography from ' + label, async () => {
  await assert.rejects(exercise({ job: { ...structuredClone(native), description: change(native.description) } }), /geography|workplace|header/i)
})

test('Algoworks preserves full-board reconciliation after explicit header interpretation', async () => {
  await assert.rejects(exercise({ override: ({ url, body }) => ({ body: url === board ? '[]' : body }) }), /inventories disagree/)
})

test('Algoworks preserves closing inventory identity after hydrating a role without structured locations', async () => {
  await assert.rejects(exercise({ override: ({ url, body, count }) => ({ body: url === active && count === 2 ? '[]' : body }) }), /inventory changed/)
})

test('Algoworks rejects a native detail whose active posting ID conflicts with the interpreted role', async () => {
  await assert.rejects(exercise({ override: ({ url, body }) => ({ body: url.includes('/jobdetails/') ? body.replace(/(selectedjobid\s*=\s*["'])94165/gi, (_, prefix) => prefix + '99999') : body }) }), /detail identity/)
})

for (const status of [401, 403, 429]) test('Algoworks keeps HTTP ' + status + ' as an unavailable inventory', async () => {
  await assert.rejects(exercise({ override: ({ url, body }) => ({ body, status: url === active ? status : 200 }) }), /HTTP or redirect identity/)
})


test('Algoworks preserves invalid native posting-date rejection on an explicit-country role', async () => {
  await assert.rejects(exercise({ job: { ...structuredClone(native), publishedOn: 'not-a-date' } }), /invalid exception posting date/)
})
