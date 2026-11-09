import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Mozark is registered as a verified first-party zero-job sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mozark')

  assert.ok(provider, 'Expected Mozark provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mozark')
  assert.equal(provider.companyCareerPage, 'https://www.mozark.ai/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-missing-sitemap-endpoints-plus-missing-careers-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-sitemap-endpoints+missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mozark.ai')
  assert.match(provider.modulePath, /mozark[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mozark'), false)
})

test('Mozark matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mozark,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mozark', 'mozark', 'Mozark']],
  )
})

test('Mozark is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mozark')

  assert.ok(scraper, 'Expected buildScrapers() to return the Mozark scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mozark')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.mozark.ai/')
  assert.match(scraper.dryRunFile, /mozark[\\/]jobs\.json$/i)
})
