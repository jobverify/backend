import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createKatalonScraper } from '../../scraper/katalon/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { isIndiaJob } from '../utils/indiaLocationFilter.js'

const captures = JSON.parse(readFileSync(new URL('../../scraper/katalon/fixtures/careers-responses.json', import.meta.url)))
const bodies = new Map(captures.map(row => [row.url, row.body]))
const official = JSON.parse(readFileSync(new URL('../../scraper/katalon/fixtures/official-response.json', import.meta.url)))
bodies.set(official.url, official.body)
const fixtureFetch = async url => {
  if (bodies.has(url)) return bodies.get(url)
  throw new Error('Unexpected request: ' + url)
}

test('Katalon rejects caller cancellation before observing the source', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancel Katalon inventory'))
  await assert.rejects(createKatalonScraper().run({ signal: controller.signal }), /cancel Katalon inventory/)
})

test('Katalon import with a parent dry-run flag has no fetch or file side effects', () => {
  const url = new URL('../../scraper/katalon/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw new Error('Unexpected file write'); };
    globalThis.fetch = () => { throw new Error('Unexpected network'); };
    process.argv.push('--dry-run');
    await import(${JSON.stringify(url)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 10000 }).trim(), 'imported')
})

test('Katalon reconciles captured complete Teamtailor inventory and preserves explicit India recruiting locations with relocation conflicts', async () => {
  const jobs = await createKatalonScraper().run({ fetchText: fixtureFetch })
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['8464989', '8557097'])
  for (const job of jobs) {
    assert.equal(job.company, 'Katalon')
    assert.equal(job.country, 'India')
    assert.equal(job.city, 'Bengaluru')
    assert.equal(isIndiaJob(job), true)
    assert.match(job.title, /Relocation to Vietnam/)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.match(job.sourceLocationConflict, /Vietnam/)
    assert.ok(job.jobDescription.length > 200)
    assert.equal(job.applyUrl, job.sourceUrl + '/applications/new')
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 14)
  assert.equal(evidence.indiaFacetCount, 2)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 5)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('Katalon rejects truncated, duplicate, missing and count-mismatched native inventories', async () => {
  const rss = bodies.get('https://careers.katalon.com/jobs.rss')
  for (const changed of [rss.replace(/<item>[\s\S]*?<\/item>/, ''), rss.replace('</channel>', rss.match(/<item>[\s\S]*?<\/item>/)[0] + '</channel>'), rss.replace('</rss>', '')]) {
    await assert.rejects(createKatalonScraper().run({ fetchText: async url => url.endsWith('.rss') ? changed : fixtureFetch(url) }), /inventory|RSS|count|duplicate|complete/i)
  }
})

test('Katalon retains enumerable India candidates when optional descriptions are unavailable', async () => {
  const jobs = await createKatalonScraper().run({ fetchText: async url => {
    const body = await fixtureFetch(url)
    if (url.endsWith('.rss')) return body.replace(/<description>[\s\S]*?<\/description>/g, '<description></description>')
    if (url.includes('/jobs/')) return body.replace(/("description"\s*:\s*)"(?:\\.|[^"\\])*"/, '$1""')
    return body
  } })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobDescription, null)
})

test('Katalon rejects altered organization, country and application identity on India details', async () => {
  for (const change of [
    body => body.replace('"name": "Katalon Careers"', '"name": "Other Company"'),
    body => body.replace(/"addressCountry"\s*:\s*"IN"/g, '"addressCountry":"VN"'),
    body => body.replaceAll('/applications/new', '/application-changed'),
  ]) await assert.rejects(createKatalonScraper().run({ fetchText: async url => {
    const body = await fixtureFetch(url)
    return url.includes('/jobs/') ? change(body) : body
  } }), /identity|country|application/i)
})

test('Katalon propagates upstream source failures and cancels between requests', async () => {
  await assert.rejects(createKatalonScraper().run({ fetchText: async () => { throw new Error('Katalon upstream failed') } }), /upstream failed/)
  const controller = new AbortController()
  await assert.rejects(createKatalonScraper().run({ signal: controller.signal, fetchText: async () => {
    controller.abort(new Error('stop after source response'))
    return ''
  } }), /stop after source response/)
})

test('Katalon never reports zero India inventory when RSS country disagrees with the visible board location', async () => {
  await assert.rejects(createKatalonScraper().run({ fetchText: async url => {
    const body = await fixtureFetch(url)
    return url.endsWith('.rss') ? body.replaceAll('<tt:country>India</tt:country>', '<tt:country>Vietnam</tt:country>') : body
  } }), /location|country/i)
})
