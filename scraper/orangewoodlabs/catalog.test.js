import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Orangewood Labs is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'orangewoodlabs')

  assert.ok(provider, 'Expected Orangewood Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Orangewood Labs')
  assert.equal(provider.companyCareerPage, 'https://orangewood.co/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-fallbacks')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-route-shell-fallbacks+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'orangewood.co')
  assert.match(provider.modulePath, /orangewoodlabs[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Orangewood Labs'), false)
})

test('Orangewood Labs resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Orangewood Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orangewood Labs', 'orangewoodlabs', 'Orangewood Labs']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'orangewoodlabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the Orangewood Labs sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'orangewoodlabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://orangewood.co/')
  assert.match(scraper.dryRunFile, /orangewoodlabs[\\/]jobs\.json$/i)
})
