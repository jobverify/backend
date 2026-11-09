import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Cafe Coffee Day with its official careers source', () => {
  const catalog = getScraperCatalog()
  const cafeCoffeeDay = catalog.find((provider) => provider.source === 'cafecoffeeday')

  assert.ok(cafeCoffeeDay)
  assert.equal(cafeCoffeeDay.companyName, 'Cafe Coffee Day')
  assert.equal(cafeCoffeeDay.adapter, 'script')
  assert.equal(cafeCoffeeDay.atsPlatform, 'official-company-careers')
  assert.equal(cafeCoffeeDay.companyCareerPage, 'https://www.cafecoffeeday.com/careers/openings')
  assert.equal(cafeCoffeeDay.companyDomain, 'cafecoffeeday.com')
  assert.equal(cafeCoffeeDay.paginationStrategy, 'single-static-openings-page')
  assert.equal(cafeCoffeeDay.extractionStrategy, 'html-role-location-listings')
})

test('buildScrapers exposes a runnable Cafe Coffee Day scraper', () => {
  const scrapers = buildScrapers()
  const cafeCoffeeDay = scrapers.find((scraper) => scraper.name === 'cafecoffeeday')

  assert.ok(cafeCoffeeDay)
  assert.equal(typeof cafeCoffeeDay.run, 'function')
  assert.match(cafeCoffeeDay.dryRunFile, /cafecoffeeday[\\/]jobs\.json$/)
  assert.equal(cafeCoffeeDay.provider.adapter, 'script')
})

test('company coverage resolves Cafe Coffee Day and Coffee Day Global Ltd. to the scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Cafe Coffee Day\n2,Coffee Day Global Ltd.\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Cafe Coffee Day', 'cafecoffeeday'],
      ['Coffee Day Global Ltd.', 'cafecoffeeday'],
    ],
  )
})
