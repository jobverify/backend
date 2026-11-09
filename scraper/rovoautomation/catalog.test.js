import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Rovo Automation is registered as a verified first-party non-listing SPA sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rovoautomation')

  assert.ok(provider, 'Expected Rovo Automation provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rovo Automation')
  assert.equal(provider.companyCareerPage, 'https://rovoautomation.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-route-plus-asset-manifest-plus-first-party-bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-shell+verified-careers-route-shell+verified-asset-manifest+verified-first-party-bundle-without-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rovoautomation.com')
  assert.match(provider.modulePath, /rovoautomation[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rovo Automation'), false)
})

test('Rovo Automation resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Rovo Automation,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rovo Automation', 'rovoautomation', 'Rovo Automation']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'rovoautomation')

  assert.ok(scraper, 'Expected buildScrapers() to return the Rovo Automation sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rovoautomation')
  assert.equal(scraper.provider.companyCareerPage, 'https://rovoautomation.com/careers')
  assert.match(scraper.dryRunFile, /rovoautomation[\\/]jobs\.json$/i)
})
