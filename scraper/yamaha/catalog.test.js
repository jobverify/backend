import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Yamaha is registered as a first-party YMRI scraper with stable catalog metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yamaha')

  assert.ok(provider, 'Expected Yamaha provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Yamaha Motor Research and Development India')
  assert.equal(provider.companyCareerPage, 'https://ymri.yamaha-motor-india.com/job-career.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'official-ymri-careers-page+inline-role-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'ymri.yamaha-motor-india.com')
  assert.match(provider.modulePath, /yamaha[\\/]script\.js$/i)
})

test('Yamaha resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Yamaha,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Yamaha', 'yamaha', 'Yamaha Motor Research and Development India']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'yamaha')

  assert.ok(scraper, 'Expected buildScrapers() to return the Yamaha scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yamaha')
  assert.equal(scraper.provider.companyName, 'Yamaha Motor Research and Development India')
  assert.match(scraper.dryRunFile, /yamaha[\\/]jobs\.json$/i)
})
