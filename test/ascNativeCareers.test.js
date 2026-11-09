import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createAscInternationalScraper, extractSearchResults, run, CAREER_PAGE_URL } from '../scraper/ascinternational/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch = async () => assert.fail('ASC native tests require injected public responses')
const html = gunzipSync(await readFile(new URL('../scraper/ascinternational/fixtures/careers-20261029.html.gz', import.meta.url))).toString()
const schema = /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi
const changePosting = transform => html.replace(schema, (whole, open, value, close) => value.includes('JobPosting')
  ? open + JSON.stringify(transform(JSON.parse(value))) + close : whole)
const response = value => ({ status: 200, url: 'https://ascinternational.com/careers', html: value })
const execute = async (value = html, options = {}) => {
  let requests = 0
  const jobs = await createAscInternationalScraper().run({
    fetchPage: async () => { requests++; return response(value) }, ...options,
  })
  return { jobs, evidence: readInventoryEvidence(jobs), requests }
}

test('ASC redesign maps its actual role and complete criteria instead of responsibility headings', () => {
  const jobs = extractSearchResults(html)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Automated Optical Inspection (AOI) Engineer')
  assert.equal(jobs[0].country, 'United States')
  assert.match(jobs[0].jobDescription, /Oversee system upgrades/)
  assert.match(jobs[0].jobDescription, /2 years of professional experience/)
  assert.doesNotMatch(jobs[0].jobDescription, /Why Build Your Career|How to Apply|Quick Links/)
})

test('ASC current country-scoped vacancy provides verified zero India with a closing inventory check', async () => {
  const { jobs, evidence, requests } = await execute()
  assert.equal(jobs.length, 0)
  assert.equal(requests, 2)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.status, 'complete-inventory')
})

test('ASC registered library entry forwards the injected native transport', async () => {
  const jobs = await run({ fetchPage: async url => { assert.equal(url, CAREER_PAGE_URL); return response(html) } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('ASC missing role-owned country cannot borrow the headquarters or mailing country', async () => {
  const value = changePosting(row => { delete row.jobLocation.address.addressCountry; return row })
  const { evidence } = await execute(value)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('ASC retains a future explicitly country-scoped India vacancy and its complete criteria', async () => {
  const value = changePosting(row => { Object.assign(row.jobLocation.address,
    { addressCountry: 'IN', addressLocality: 'Chennai', addressRegion: 'Tamil Nadu' }); return row })
    .replace('Medina, MN (HQ)', 'Chennai, Tamil Nadu')
  const { jobs, evidence } = await execute(value)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Chennai')
  assert.match(jobs[0].jobDescription, /Oversee system upgrades/)
  assert.match(jobs[0].jobDescription, /Required Qualifications/)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.listingComplete, true)
})

test('ASC extra structured address geography and visible worksite alternatives remain unresolved', async () => {
  const extra = changePosting(row => { row.jobLocation.address.additional_locations = ['Chennai, India']; return row })
  for (const value of [extra, html.replace('Medina, MN (HQ)', 'Medina, MN (HQ); Chennai, India')]) {
    const { evidence } = await execute(value)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('ASC unrepresented postings and hidden role criteria cannot prove a complete inventory', async () => {
  const extra = changePosting(row => [row, { ...row, title: 'Another Engineer' }])
  await assert.rejects(execute(extra), /native|role|criteria|inventory/i)
  const hidden = html.replace('>Key Responsibilities</h4>', ' hidden>Key Responsibilities</h4>')
  await assert.rejects(execute(hidden), /native|role|criteria|inventory/i)
  const hiddenQualifications = html.replace(/(>Required Qualifications<\/h4>\s*<ul)(\b[^>]*>)/, '$1 hidden$2')
  assert.notEqual(hiddenQualifications, html)
  await assert.rejects(execute(hiddenQualifications), /native|role|criteria|inventory/i)
})

test('ASC additional hiring inventories remain unresolved', async () => {
  for (const link of ['<a href="https://jobs.lever.co/other">Other open roles</a>',
    '<a href="https://jobs.ashbyhq.com/another-employer">Opportunities</a>',
    '<a href="https://boards.greenhouse.io/another-employer"><img alt="Explore"></a>']) {
    const { evidence } = await execute(html.replace('</main>', link + '</main>'))
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('ASC additional worksite statements within role criteria cannot disappear from location scope', async () => {
  for (const statement of ['Additional work location: Chennai, India', 'Country: India']) {
    const value = html.replace('>Key Responsibilities</h4>', `>Key Responsibilities</h4><p>${statement}</p>`)
    const { evidence } = await execute(value)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('ASC requires successful metadata from the pinned first-party careers route', async () => {
  for (const changed of [{ status: 403 }, { url: 'https://unrelated.example/careers' }, { url: 'https://ascinternational.com/about' }]) {
    await assert.rejects(execute(html, { fetchPage: async () => ({ ...response(html), ...changed }) }), /HTTP|native|careers|identity|response/i)
  }
})

test('ASC a changed closing inventory cannot authorize complete coverage', async () => {
  let count = 0
  const changed = html.replace('Oversee system upgrades', 'Oversee additional system upgrades')
  const { evidence } = await execute(html, { fetchPage: async () => response(++count === 1 ? html : changed) })
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /closing|changed/)
})

test('ASC cancellation at a native response boundary preserves unknown coverage', async () => {
  const controller = new AbortController()
  await assert.rejects(execute(html, { signal: controller.signal, fetchPage: async () => {
    controller.abort(new Error('ASC native check cancelled'))
    return response(html)
  } }), /cancelled/)
})
