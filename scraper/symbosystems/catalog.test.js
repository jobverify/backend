import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Symbo Systems is registered as a verified first-party blocked-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'symbosystems')

  assert.ok(provider, 'Expected Symbo Systems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Symbo Systems')
  assert.equal(provider.companyCareerPage, 'https://www.symbosystems.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-blocked-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-without-careers-links+verified-blocked-careers-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'symbosystems.com')
  assert.match(provider.modulePath, /symbosystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Symbo Systems'), false)
})

test('Symbo Systems resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Symbo Systems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Symbo Systems', 'symbosystems', 'Symbo Systems']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'symbosystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the Symbo Systems sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'symbosystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.symbosystems.com/')
  assert.match(scraper.dryRunFile, /symbosystems[\\/]jobs\.json$/i)
})
