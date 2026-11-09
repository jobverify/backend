import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Impacto is registered as a verified first-party zero-job scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'impacto')

  assert.ok(provider, 'Expected Impacto provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Impacto')
  assert.equal(provider.companyCareerPage, 'https://impacto.co.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'impacto.co.in')
  assert.match(provider.modulePath, /impacto[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Impacto'), false)
})

test('Impacto matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Impacto,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Impacto', 'impacto', 'Impacto']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'impacto')

  assert.ok(scraper, 'Expected buildScrapers() to return the Impacto scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'impacto')
  assert.equal(scraper.provider.companyCareerPage, 'https://impacto.co.in/')
  assert.match(scraper.dryRunFile, /impacto[\\/]jobs\.json$/i)
})
