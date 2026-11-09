import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Knowledge Lens is registered as a verified retired-brand zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'knowledgelens')

  assert.ok(provider, 'Expected Knowledge Lens provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Knowledge Lens')
  assert.equal(provider.companyCareerPage, 'https://www.knowledgelens.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'retired-brand-homepage-plus-parent-careers-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-retired-brand-homepage+verified-parent-careers-without-brand-specific-openings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'knowledgelens.com')
  assert.match(provider.modulePath, /knowledgelens[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Knowledge Lens'), false)
})

test('Knowledge Lens matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Knowledge Lens,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Knowledge Lens', 'knowledgelens', 'Knowledge Lens']],
  )
})

test('Knowledge Lens is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'knowledgelens')

  assert.ok(scraper, 'Expected buildScrapers() to return the Knowledge Lens scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'knowledgelens')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.knowledgelens.com/')
  assert.match(scraper.dryRunFile, /knowledgelens[\\/]jobs\.json$/i)
})
