import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { run } from '../../scraper/pocketfm/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const root = new URL('../../scraper/pocketfm/fixtures/', import.meta.url)
const read = name => JSON.parse(readFileSync(new URL(name, root)))
const home = read('home-response.json'), board = read('board-response.json'), clients = read('client-api-responses.json'), parents = read('client-parent-responses.json'), listings = read('listing-responses.json')
const original = JSON.parse(listings[0].body)
const textMap = new Map([home, board, ...clients, ...parents].map(row => [row.url, row.body]))
const fixtureOptions = (records = structuredClone(original)) => ({
  fetchText: async url => { assert.ok(textMap.has(url), url); return textMap.get(url) },
  fetchJson: async url => { assert.equal(url, 'https://api.lever.co/v0/postings/pocketfm?mode=json&skip=0&limit=100'); return records },
})

test('Pocket FM captured official client and native board/API reconcile ten jobs and two India postings', async () => {
  const jobs = await run(fixtureOptions())
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['2436065b-281d-4347-8366-9a60b99dc5a5', '5b82d0d8-4ca5-4d87-ad95-eb5b8e5fb9c8'])
  for (const job of jobs) {
    const native = original.find(row => row.id === job.jobId)
    assert.equal(job.company, 'Pocket FM')
    assert.equal(job.source, 'pocketfm')
    assert.equal(job.sourceUrl, native.hostedUrl)
    assert.equal(job.applyUrl, native.applyUrl)
    assert.equal(job.country, 'India')
    assert.equal(job.city, 'Bangalore')
    assert.equal(job.nativeCreatedAt, native.createdAt)
    assert.equal(job.postingDate, null)
    assert.ok(job.jobDescription.length > 100)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 10)
  assert.equal(evidence.indiaFacetCount, 2)
  assert.equal(evidence.listingComplete, true)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('Pocket FM fails on missing native records, duplicate UUIDs and foreign tenant application identities', async () => {
  for (const records of [original.slice(1), [...original, original[0]], original.map((row, index) => index ? row : { ...row, applyUrl: row.applyUrl.replace('pocketfm', 'other') }), []]) {
    await assert.rejects(run(fixtureOptions(records)), /inventory|identity|board|duplicate/i)
  }
})

test('Pocket FM retains missing selected employer descriptions with incomplete inventory evidence', async () => {
  const records = structuredClone(original)
  for (const row of records.filter(row => row.country === 'IN')) {
    for (const field of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain']) row[field] = ''
    row.lists = []
  }
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Pocket FM preserves candidates but never completes unresolved secondary geography', async () => {
  const records = structuredClone(original)
  records[0].categories.allLocations.push('Remote')
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Pocket FM rejects contradictory primary native country and location', async () => {
  const records = structuredClone(original)
  records.find(row => row.country === 'IN').country = 'JP'
  await assert.rejects(run(fixtureOptions(records)), /country|geograph|contradict/i)
})

test('Pocket FM honours cancellation and bounds a noncooperative transport', async () => {
  const controller = new AbortController()
  controller.abort(Error('stop Pocket FM'))
  await assert.rejects(run({ signal: controller.signal, ...fixtureOptions() }), /stop Pocket FM/)
  await assert.rejects(run({ timeoutMs: 20, fetchText: () => new Promise(() => {}) }), /timed out/)
})

test('Pocket FM import with a parent dry-run flag neither fetches nor writes', () => {
  const url = new URL('../../scraper/pocketfm/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs'; fs.writeFileSync = () => { throw Error('Unexpected import write'); };
    globalThis.fetch = () => { throw Error('Unexpected import fetch'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(url)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 10000 }).trim(), 'imported')
})

test('Pocket FM selects native secondary India geography behind a foreign primary country', async () => {
  const records = structuredClone(original)
  records[0].categories.allLocations.push('Bengaluru, India')
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.length, 3)
  assert.equal(jobs.find(job => job.jobId === records[0].id).location, 'Bengaluru, India')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
})

test('Pocket FM preserves explicit publication separately from creation and rejects unsupported dates', async () => {
  const records = structuredClone(original)
  records.find(row => row.country === 'IN').datePosted = '2020-01-01T00:00:00Z'
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.find(job => job.jobId === records[1].id).postingDate, '2020-01-01T00:00:00.000Z')
  for (const change of [{ datePosted: '2026-02-30' }, { publishedAt: '2020-01-01T00:00:00Z' }, { country: 'India' }]) {
    const invalid = structuredClone(original)
    Object.assign(invalid[1], change)
    await assert.rejects(run(fixtureOptions(invalid)), /date|publication|country|calendar/i)
  }
})

test('Pocket FM follows native skip/limit boundaries and requires a terminal short page', async () => {
  // Synthetic contract variant of the captured board structure, not a live capture.
  const records = Array.from({ length: 101 }, (_, index) => {
    const row = structuredClone(original[0])
    row.id = '00000000-0000-4000-8000-' + String(index).padStart(12, '0')
    row.hostedUrl = 'https://jobs.lever.co/pocketfm/' + row.id
    row.applyUrl = row.hostedUrl + '/apply'
    return row
  })
  const syntheticBoard = '<html><head><title>Pocket Entertainment Corp</title><meta property="og:url" content="https://jobs.lever.co/pocketfm"></head><body>'
    + records.map(row => `<div class="posting" data-qa-posting-id="${row.id}"><a class="posting-title" href="${row.hostedUrl}"><h5 data-qa="posting-name">Audio Engineer</h5><span class="location">Tokyo</span></a></div>`).join('') + '</body></html>'
  const calls = []
  const jobs = await run({ ...fixtureOptions(), fetchText: async url => url === 'https://jobs.lever.co/pocketfm' ? syntheticBoard : textMap.get(url),
    fetchJson: async url => { calls.push(url); return url.includes('skip=0&') ? records.slice(0, 100) : records.slice(100) } })
  assert.deepEqual(calls, ['https://api.lever.co/v0/postings/pocketfm?mode=json&skip=0&limit=100', 'https://api.lever.co/v0/postings/pocketfm?mode=json&skip=100&limit=100'])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 101)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  await assert.rejects(run({ ...fixtureOptions(records.slice(0, 100)), maxPages: 1 }), /pagination limit/i)
})

test('Pocket FM rejects changed official careers binding and truncated native board markup', async () => {
  for (const mutate of [
    (url, body) => url.includes('/_next/') ? body.replace('https://jobs.lever.co/pocketfm', 'https://jobs.lever.co/other') : body,
    (url, body) => url === 'https://jobs.lever.co/pocketfm' ? body.replace('</body>', '') : body,
  ]) await assert.rejects(run({ ...fixtureOptions(), fetchText: async url => mutate(url, textMap.get(url)) }), /binding|unclosed|board/i)
})

test('Pocket FM refuses explicit unpublished lifecycle evidence in otherwise valid native records', async () => {
  const records = structuredClone(original)
  records[0].published = false
  await assert.rejects(run(fixtureOptions(records)), /unpublished|publication|lifecycle/i)
})

test('Pocket FM requires the careers client chunk to remain linked through the current homepage asset graph', async () => {
  for (const mutate of [
    (url, body) => url === 'https://pocketfm.com/' ? body.replaceAll('2y_ptw0orekjx.js', 'other.js') : body,
    (url, body) => url.endsWith('/2y_ptw0orekjx.js') ? body.replaceAll('0plbo-9g--9fh.js', 'other.js') : body,
  ]) await assert.rejects(run({ ...fixtureOptions(), fetchText: async url => mutate(url, textMap.get(url)) }), /client|asset|binding/i)
})

test('Pocket FM section headings cannot turn empty native employer content into a complete description', async () => {
  const records = structuredClone(original)
  for (const row of records.filter(row => row.country === 'IN')) {
    for (const field of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) row[field] = ''
    row.lists = [{ text: 'Requirements', content: '<p>&nbsp;</p>' }]
  }
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Pocket FM rejects an Indian city name carrying an explicit foreign state on a secondary location', async () => {
  const records = structuredClone(original)
  records[0].categories.allLocations.push('Bengaluru, CA')
  await assert.rejects(run(fixtureOptions(records)), /contradict|geograph|country/i)
})

test('Pocket FM heading-only native bodies retain India candidates with incomplete descriptions', async () => {
  const records = structuredClone(original)
  for (const row of records.filter(row => row.country === 'IN')) {
    for (const field of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'opening', 'openingPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain']) row[field] = ''
    row.descriptionBody = '<h3>Requirements</h3>'
    row.lists = []
  }
  const jobs = await run(fixtureOptions(records))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
