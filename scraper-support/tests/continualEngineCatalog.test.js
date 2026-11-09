import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog registers Continual Engine with its official careers page', () => {
  const catalog = getScraperCatalog()
  const continualEngine = catalog.find((provider) => provider.source === 'continualengine')

  assert.ok(continualEngine)
  assert.equal(continualEngine.companyName, 'Continual Engine')
  assert.equal(continualEngine.adapter, 'script')
  assert.equal(continualEngine.atsPlatform, 'official-company-careers')
  assert.equal(continualEngine.companyCareerPage, 'https://www.continualengine.com/careers/')
  assert.equal(continualEngine.companyDomain, 'continualengine.com')
  assert.equal(continualEngine.paginationStrategy, 'single-static-careers-page')
  assert.equal(continualEngine.extractionStrategy, 'html-elementor-accordion')
})

test('buildScrapers exposes a runnable Continual Engine scraper', () => {
  const scrapers = buildScrapers()
  const continualEngine = scrapers.find((scraper) => scraper.name === 'continualengine')

  assert.ok(continualEngine)
  assert.equal(typeof continualEngine.run, 'function')
  assert.match(continualEngine.dryRunFile, /continualengine[\\/]jobs\.json$/)
  assert.equal(continualEngine.provider.source, 'continualengine')
})

test('company coverage resolves Continual Engine aliases to the scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Continual Engine\n2,ContinualEngine\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Continual Engine', 'continualengine'],
      ['ContinualEngine', 'continualengine'],
    ],
  )
})
