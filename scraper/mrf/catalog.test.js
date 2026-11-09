import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('MRF Limited is registered against its verified first-party careers handoff with the exact MRF TYRES alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mrf')

  assert.ok(
    provider,
    'Expected MRF Limited provider to be registered in customProviders.json',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MRF Limited')
  assert.equal(provider.companyCareerPage, 'https://www.mrftyres.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-redirect-plus-public-api-post')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-redirect+verified-public-campusrequisition-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mrftyres.com')
  assert.match(provider.modulePath, /mrf[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MRF Limited'), false)
  assert.equal(companyAliases['MRF TYRES'], 'mrf')
})

test('MRF Limited and MRF TYRES both resolve in company coverage to the same scraper lane', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'MRF Limited,\nMRF TYRES,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['MRF Limited', 'mrf', 'MRF Limited'],
      ['MRF TYRES', 'mrf', 'MRF Limited'],
    ],
  )
})

test('MRF is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mrf')

  assert.ok(scraper, 'Expected buildScrapers() to return the MRF scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mrf')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.mrftyres.com/careers')
  assert.match(scraper.dryRunFile, /mrf[\\/]jobs\.json$/i)
})
