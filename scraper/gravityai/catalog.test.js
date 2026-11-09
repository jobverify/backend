import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Gravity AI is registered as a verified no-public-jobs sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gravityai')

  assert.ok(provider, 'Expected Gravity AI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gravity AI')
  assert.equal(provider.companyCareerPage, 'https://www.gravity-ai.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-sitemap-role-pages-and-missing-careers-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+sitemap-and-role-pages+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gravity-ai.com')
  assert.match(provider.modulePath, /gravityai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Gravity AI'), false)
})

test('Gravity AI matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Gravity AI\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gravity AI', 'gravityai', 'Gravity AI']],
  )
})

test('Gravity AI is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gravityai')

  assert.ok(scraper, 'Expected buildScrapers() to return the Gravity AI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gravityai')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.gravity-ai.com/')
  assert.match(scraper.dryRunFile, /gravityai[\\/]jobs\.json$/i)
})
