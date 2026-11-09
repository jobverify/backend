import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { run } from '../../scraper/zoox/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const root = new URL('../../scraper/zoox/fixtures/', import.meta.url)
const read = name => JSON.parse(readFileSync(new URL(name, root)))
const careers = read('careers-response.json'), clients = read('client-api-responses.json'), board = read('board-response.json'), pages = read('listing-responses.json')
const native = pages.flatMap(row => JSON.parse(row.body))
const textMap = new Map([careers, ...clients, board].map(row => [row.url, row.body]))
const replay = (mutate = records => records) => ({ fetchText: async url => { assert.ok(textMap.has(url), url); return textMap.get(url) },
  fetchJson: async url => { const row = pages.find(row => row.url === url); assert.ok(row, url); return mutate(JSON.parse(row.body)) } })
// Synthetic future contract variants; actual captures currently have no India role.
const india = (changes = {}) => ({ ...structuredClone(native[0]), country: 'IN', categories: { ...native[0].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] }, ...changes })
const syntheticBoard = rows => '<html><head><title>Zoox</title><meta property="og:url" content="https://jobs.lever.co/zoox"></head><body>'
  + rows.map(row => `<div class="posting" data-qa-posting-id="${row.id}"><a class="posting-title" href="${row.hostedUrl}"><h5 data-qa="posting-name">${row.text}</h5><span class="location">${row.categories.allLocations.join(' / ')}</span></a></div>`).join('') + '</body></html>'
const synthetic = rows => ({ fetchText: async url => url === 'https://jobs.lever.co/zoox' ? syntheticBoard(rows) : textMap.get(url), fetchJson: async () => rows })

test('Zoox observes caller cancellation before attempting native inventory', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stop Zoox source'))
  await assert.rejects(run({ signal: controller.signal }), /stop Zoox source/)
})

test('Zoox import with a parent dry-run flag has no network or file side effects', () => {
  const url = new URL('../../scraper/zoox/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs'; fs.writeFileSync = () => { throw Error('Unexpected import write'); };
    globalThis.fetch = () => { throw Error('Unexpected import fetch'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(url)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 10000 }).trim(), 'imported')
})

test('Zoox captured three-page inventory reconciles all 237 board postings and proves zero India locations', async () => {
  const jobs = await run(replay())
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 237)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 3)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('Zoox future India rows retain exact identity, native creation and explicit publication dates', async () => {
  const row = india({ datePosted: '2020-01-01T00:00:00Z' })
  const jobs = await run(synthetic([row]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Zoox')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, row.id)
  assert.equal(jobs[0].applyUrl, row.applyUrl)
  assert.equal(jobs[0].nativeCreatedAt, row.createdAt)
  assert.equal(jobs[0].postingDate, '2020-01-01T00:00:00.000Z')
  assert.ok(jobs[0].jobDescription.length > 200)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Zoox selects explicit secondary India geography despite foreign primary and keeps unknown secondary scope incomplete', async () => {
  const row = structuredClone(native[0])
  row.categories.allLocations.push('Bengaluru, India')
  const jobs = await run(synthetic([row]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, India')
  row.categories.allLocations.push('Remote')
  const partial = await run(synthetic([row]))
  assert.equal(partial.length, 1)
  assert.equal(partial[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(partial).indiaFacetCount, null)
})

test('Zoox keeps descriptionless India vacancies partial and empty section headings cannot fabricate a JD', async () => {
  const row = india()
  for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) row[key] = ''
  row.lists = [{ text: 'Requirements', content: '<p>&nbsp;</p>' }]
  const jobs = await run(synthetic([row]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Zoox rejects truncated, duplicate and foreign-tenant inventories instead of reporting zero', async () => {
  for (const mutate of [rows => rows.slice(1), rows => [...rows, rows[0]], rows => rows.map((row, index) => index ? row : { ...row, applyUrl: row.applyUrl.replace('/zoox/', '/other/') })]) {
    await assert.rejects(run(replay(mutate)), /inventory|duplicate|identity|board/i)
  }
})

test('Zoox missing native country preserves incomplete scope while contradictory country fails', async () => {
  const unknown = structuredClone(native[0]); unknown.country = null
  const jobs = await run(synthetic([unknown]))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  await assert.rejects(run(synthetic([india({ country: 'US' })])), /country|contradict|geograph/i)
})

test('Zoox checks current first-party asset binding and bounds stalled transport and body reads', async t => {
  await assert.rejects(run({ ...replay(), fetchText: async url => url === 'https://zoox.com/careers' ? careers.body.replaceAll('careers-f5d415fc3e2c5db9.js', 'other.js') : textMap.get(url) }), /binding|client|asset/i)
  await assert.rejects(run({ timeoutMs: 20, fetchText: () => new Promise(() => {}) }), /timed out/i)
  t.mock.method(globalThis, 'fetch', async url => ({ status: 200, url, text: () => new Promise(() => {}) }))
  await assert.rejects(run({ timeoutMs: 20 }), /timed out/i)
})

test('Zoox company opening and compensation prose cannot replace a missing native role description', async () => {
  const row = india()
  for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain']) row[key] = ''
  row.lists = []
  row.openingPlain = 'Zoox builds the future of transportation.'
  row.additionalPlain = 'Zoox is an equal opportunity employer.'
  const jobs = await run(synthetic([row]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Zoox rejects explicit unpublished status and impossible native publication dates', async () => {
  for (const change of [{ published: false }, { status: 'closed' }, { datePosted: '2026-02-30' }, { publishedAt: '2020-01-01T00:00:00Z' }]) {
    await assert.rejects(run(synthetic([india(change)])), /publication|unpublished|date|calendar/i)
  }
})

test('Zoox does not accept truncated first-party careers markup as current client binding proof', async () => {
  for (const closing of ['</html>', '</body>']) {
    await assert.rejects(run({ ...replay(), fetchText: async url => url === 'https://zoox.com/careers' ? careers.body.replace(closing, '') : textMap.get(url) }), /envelope|unclosed|careers/i)
  }
})

test('Zoox rejects an Indian city name carrying an explicit foreign state on a secondary location', async () => {
  const row = structuredClone(native[0])
  row.categories.allLocations.push('Bengaluru, CA')
  await assert.rejects(run(synthetic([row])), /contradict|geograph|country/i)
})

test('Zoox heading-only native body cannot create a complete employer description', async () => {
  const row = india()
  for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) row[key] = ''
  row.descriptionBody = '<h3>Requirements</h3>'
  row.lists = []
  const jobs = await run(synthetic([row]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
