import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nRivian\n"

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

test('Rivian provider preserves the complete captured native no-India inventory evidence', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'rivian')

  assert.ok(scraper, 'Expected Rivian scraper to be built from its provider extension')
  const pages = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/rivian/fixtures/listing-responses.json.gz', import.meta.url))))
  let page = 0
  const jobs = await scraper.run({ fetchPage: async url => {
    const name = url.endsWith('/work') ? 'work-response' : 'search-response'
    const capture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/rivian/fixtures/' + name + '.json.gz', import.meta.url))))
    assert.equal(url, capture.url)
    return { status: capture.status, url: capture.finalUrl, html: capture.body }
  }, fetchJson: async url => {
    const capture = pages[page++]
    assert.equal(url, capture.url)
    return JSON.parse(capture.body)
  } })
  assert.equal(page, 10)
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 947)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
