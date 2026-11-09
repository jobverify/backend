import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('RevGain AI is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'revgainai')

  assert.ok(provider, 'Expected RevGain AI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'RevGain AI')
  assert.equal(provider.companyCareerPage, 'https://revgain.ai/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-common-careers-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap-without-careers+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'revgain.ai')
  assert.match(provider.modulePath, /revgainai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'RevGain AI'), false)
})

test('RevGain AI resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'RevGain AI,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RevGain AI', 'revgainai', 'RevGain AI']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'revgainai')

  assert.ok(scraper, 'Expected buildScrapers() to return the RevGain AI sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'revgainai')
  assert.equal(scraper.provider.companyCareerPage, 'https://revgain.ai/')
  assert.match(scraper.dryRunFile, /revgainai[\\/]jobs\.json$/i)
})
