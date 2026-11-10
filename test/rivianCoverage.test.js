import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nRivian\n"
const fixtureDirectory = new URL('../scraper/rivian/fixtures/', import.meta.url)
const readCapture = name => JSON.parse(gunzipSync(readFileSync(new URL(name, fixtureDirectory))))
const sha256 = value => createHash('sha256').update(value).digest('hex')

test('Rivian is covered only by its exact-name first-party provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'rivian')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nRivian Automotive\nRivian India\n',
    catalog,
  })

  assert.ok(provider, 'Expected Rivian provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Rivian')
  assert.equal(provider.companyDomain, 'rivian.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.match(provider.modulePath, /rivian[\\/]script\.js$/)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Rivian').map((item) => item.source),
    ['rivian'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Rivian archival receipts retain their original relevance URLs, hashes and 947 no-India records', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureDirectory)))
  for (const file of manifest.files) {
    const compressed = readFileSync(new URL(file.file, fixtureDirectory))
    const original = gunzipSync(compressed)
    assert.equal(sha256(compressed), file.compressedSha256)
    assert.equal(sha256(original), file.captureSha256)
    const value = JSON.parse(original)
    const captures = Array.isArray(value) ? value : [value]
    assert.equal(captures.length, file.responses.length)
    for (const [index, capture] of captures.entries()) {
      const receipt = file.responses[index]
      assert.equal(capture.url, receipt.url)
      assert.equal(capture.finalUrl, receipt.finalUrl)
      assert.equal(capture.status, receipt.status)
      assert.equal(sha256(capture.body), receipt.bodySha256)
    }
  }
  const pages = readCapture('listing-responses.json.gz')
  assert.equal(pages.length, 10)
  const records = []
  for (const [index, capture] of pages.entries()) {
    assert.equal(capture.url, `https://careers.rivian.com/api/jobs?page=${index + 1}&limit=100&sortBy=relevance&descending=false&internal=false&tags2=Rivian%20Automotive&domain=rivian.jibeapply.com`)
    const payload = JSON.parse(capture.body)
    assert.equal(payload.count, 947)
    assert.equal(payload.totalCount, 947)
    assert.equal(payload.jobs.length, index === 9 ? 47 : 100)
    records.push(...payload.jobs)
  }
  assert.equal(records.length, 947)
  assert.equal(new Set(records.map(row => row.data.req_id)).size, 947)
  for (const { data } of records) {
    assert.notEqual(data.country_code, 'IN')
    assert.ok(data.meta_data.googlejobs.derivedInfo.locations.every(location => location.postalAddress.regionCode !== 'IN'))
  }
})

test('Rivian registered provider reconciles all 947 native records through a synthetic posting-date pagination control', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'rivian')

  assert.ok(scraper, 'Expected Rivian scraper to be built from its provider extension')
  // The archived HTTP responses used relevance ordering. These synthetic pages
  // exercise the current date ordering; they are not relabeled capture receipts.
  const records = structuredClone(readCapture('listing-responses.json.gz').flatMap(capture => JSON.parse(capture.body).jobs))
    .sort((left, right) => Date.parse(right.data.posted_date) - Date.parse(left.data.posted_date))
  let page = 0
  const jobs = await scraper.run({ fetchPage: async url => {
    const name = url.endsWith('/work') ? 'work-response' : 'search-response'
    const capture = readCapture(name + '.json.gz')
    assert.equal(url, capture.url)
    return { status: capture.status, url: capture.finalUrl, html: capture.body }
  }, fetchJson: async url => {
    assert.equal(url, `https://careers.rivian.com/api/jobs?page=${++page}&limit=100&sortBy=posted_date&descending=true&internal=false&tags2=Rivian%20Automotive&domain=rivian.jibeapply.com`)
    return { jobs: structuredClone(records.slice((page - 1) * 100, page * 100)), count: 947, totalCount: 947 }
  } })
  assert.equal(page, 10)
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 947)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 10)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})
