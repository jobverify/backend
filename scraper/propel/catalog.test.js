import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Propel is registered against its verified Ashby job board without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'propel')

  assert.ok(provider, 'Expected Propel provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Propel')
  assert.equal(provider.companyCareerPage, 'https://www.propel.app/careers/')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-ashby-job-board-endpoint')
  assert.equal(provider.extractionStrategy, 'public-ashby-job-board-json')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'propel.app')
  assert.match(provider.modulePath, /propel[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Propel'), false)
})

test('Propel resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Propel,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Propel', 'propel', 'Propel']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'propel')

  assert.ok(scraper, 'Expected buildScrapers() to return the Propel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'propel')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.propel.app/careers/')
  assert.match(scraper.dryRunFile, /propel[\\/]jobs\.json$/i)
})
