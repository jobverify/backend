import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('OnePaper Research Analysts Pvt Ltd is registered as a verified first-party zero-public-careers sentinel with the singular company alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'onepaperresearchanalystpvtltd')

  assert.ok(provider, 'Expected OnePaper Research Analysts Pvt Ltd provider in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'OnePaper Research Analysts Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.onepaper.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-validation-plus-common-careers-404-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'onepaper.in')
  assert.match(provider.modulePath, /onepaperresearchanalystpvtltd[\\/]script\.js$/i)
  assert.equal(
    companyAliases['Onepaper Research analyst Pvt Ltd'],
    'onepaperresearchanalystpvtltd',
  )
})

test('Onepaper Research analyst Pvt Ltd matches through the alias and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Onepaper Research analyst Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Onepaper Research analyst Pvt Ltd',
      'onepaperresearchanalystpvtltd',
      'OnePaper Research Analysts Pvt Ltd',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'onepaperresearchanalystpvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the OnePaper scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'onepaperresearchanalystpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.onepaper.in/')
  assert.match(scraper.dryRunFile, /onepaperresearchanalystpvtltd[\\/]jobs\.json$/i)
})
