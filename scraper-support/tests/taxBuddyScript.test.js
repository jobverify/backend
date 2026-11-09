import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nTaxBuddy\n"

test('TaxBuddy is covered exactly by its official employer discovery provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'taxbuddy')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })

  assert.ok(provider, 'Expected TaxBuddy provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'TaxBuddy')
  assert.equal(provider.companyDomain, 'taxbuddy.com')
  assert.equal(provider.atsPlatform, 'officially-linked-employer-search-unverified-company-scope')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'TaxBuddy').map((item) => item.source),
    ['taxbuddy'],
  )
})

test('TaxBuddy registered scraper reports inaccessible recruiting as a coverage gap', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'taxbuddy')

  assert.ok(scraper, 'Expected TaxBuddy scraper to be built from its provider extension')
  await assert.rejects(scraper.run({fetchImpl:async()=>{throw Error('offline')}}),{code:'TAXBUDDY_COVERAGE_GAP'})
})
