import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CreatED is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'createed')

  assert.ok(provider, 'Expected CreatED provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CreatED')
  assert.equal(provider.companyCareerPage, 'https://www.create-ed.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-and-sitemap-validation-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'create-ed.in')
  assert.match(provider.modulePath, /createed[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CreatED'), false)
})

test('CreatED resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CreatED,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CreatED', 'createed', 'CreatED']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'createed')

  assert.ok(scraper, 'Expected buildScrapers() to return the CreatED sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'createed')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.create-ed.in/')
  assert.match(scraper.dryRunFile, /createed[\\/]jobs\.json$/i)
})
