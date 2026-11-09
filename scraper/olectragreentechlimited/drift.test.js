import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

const readCurrent = async url => {
  if (url === scraper.HOMEPAGE_URL) return fixture('olectra-home.html')
  if (url.endsWith('/career')) return fixture('olectra-career.html')
  if (url.includes('/openings/')) return fixture('olectra-' + url.split('/').at(-1) + '.html')
  throw new Error('Unexpected current-source URL: ' + url)
}

test('Olectra replacement Next careers and detail pages publish three verified India openings', async () => {
  const jobs = await scraper.run({ fetchText: readCurrent })
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(j => j.country === 'India' && j.sourceUrl.startsWith('https://www.olectra.com/openings/') && j.applyUrl === j.sourceUrl))
  assert.deepEqual(jobs.map(j => j.city).sort(), ['Hyderabad','Hyderabad','Seetharampur'])
  assert.ok(jobs.every(j => j.jobDescription?.length > 100 && j.minimumQualification && j.experienceRequired))
})

test('Olectra rejects mismatched job details and unknown role geography', async () => {
  await assert.rejects(scraper.run({ fetchText: async url => (await readCurrent(url)).replaceAll('Seetharampur, Telangana', 'Remote') }), /geography|location/i)
  await assert.rejects(scraper.run({ fetchText: async url => (await readCurrent(url)).replace(url.includes('/openings/') ? '"jobStatus":"Open"' : '__never__', '"jobStatus":"Unknown"') }), /closed|status|detail/i)
})

test('Olectra skips explicitly closed details still linked by the careers listing', async () => {
  const jobs = await scraper.run({ fetchText: async url => (await readCurrent(url)).replace(
    url.includes('/openings/') ? '"jobStatus":"Open"' : '__never__', '"jobStatus":"Closed"') })
  assert.deepEqual(jobs, [])
})

test('Olectra does not trust closed status on a mismatched role', async () => {
  await assert.rejects(scraper.run({ fetchText: async url => (await readCurrent(url)).replace(
    url.includes('/openings/') ? '"jobStatus":"Open"' : '__never__', '"jobStatus":"Closed","documentId":"wrong-identity"') }), /detail|identity|mismatch/i)
})

test('Olectra accepts its current empty careers listing with rendered no-openings text', async () => {
  const jobs = await scraper.run({ fetchText: async url => url.endsWith('/career')
    ? fixture('olectra-empty-career.html') : readCurrent(url) })
  assert.deepEqual(jobs, [])
})

test('Olectra cannot verify an empty listing from Next data without rendered matching text', () => {
  const original = fixture('olectra-empty-career.html')
  const scriptStart = original.indexOf('<script id="__NEXT_DATA__"')
  const html = original.slice(0, scriptStart).replaceAll('suitable opportunity arises.', 'future opportunities.') + original.slice(scriptStart)
  assert.throws(() => scraper.extractCurrentOpeningSummaries(html), /rendered no-openings evidence/i)
})
