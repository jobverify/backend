import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('VECV is registered as an official-site blocked-careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vecv')

  assert.ok(provider, 'Expected VECV provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'VE Commercial Vehicles')
  assert.equal(provider.companyCareerPage, 'https://www.vecv.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-official-careers-route-validation')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage-plus-blocked-or-nonpublic-careers-route-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'vecv.in')
  assert.match(provider.modulePath, /vecv[\\/]script\.js$/i)
})

test('VECV resolves VE Commercial Vehicles directly and the VECV expanded form through the alias map', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'VE Commercial Vehicles,\nVECV (Volvo Eicher Commercial Vehicles),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['VE Commercial Vehicles', 'vecv', 'VE Commercial Vehicles'],
      ['VECV (Volvo Eicher Commercial Vehicles)', 'vecv', 'VE Commercial Vehicles'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vecv')

  assert.ok(scraper, 'Expected buildScrapers() to return the VECV scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vecv')
  assert.equal(scraper.provider.companyName, 'VE Commercial Vehicles')
  assert.match(scraper.dryRunFile, /vecv[\\/]jobs\.json$/i)
})
