import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('AstraEDA Pvt Ltd is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'astraedapvtltd')

  assert.ok(provider, 'Expected AstraEDA Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'AstraEDA Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://astraeda.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-fallbacks')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-route-shell-fallbacks+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'astraeda.com')
  assert.match(provider.modulePath, /astraedapvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AstraEDA Pvt Ltd'), false)
})

test('AstraEDA Pvt Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'AstraEDA Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AstraEDA Pvt Ltd', 'astraedapvtltd', 'AstraEDA Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'astraedapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the AstraEDA Pvt Ltd sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'astraedapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://astraeda.com/')
  assert.match(scraper.dryRunFile, /astraedapvtltd[\\/]jobs\.json$/i)
})
