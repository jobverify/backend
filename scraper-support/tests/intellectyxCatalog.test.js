import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Intellectyx is registered as a canonical verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intellectyx')

  assert.ok(provider, 'Expected Intellectyx provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Intellectyx Data Science Pvt.Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.intellectyx.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-resume-only-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-first-party-careers-page-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'intellectyx.com')
  assert.match(provider.modulePath, /intellectyx[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Intellectyx'), false)
})

test('Intellectyx matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Intellectyx,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Intellectyx', 'intellectyx', 'Intellectyx Data Science Pvt.Ltd']],
  )
})

test('Intellectyx Data Science Pvt.Ltd maps to the canonical Intellectyx scraper via provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Intellectyx Data Science Pvt.Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Intellectyx Data Science Pvt.Ltd', 'intellectyx', 'Intellectyx Data Science Pvt.Ltd']],
  )
})

test('Intellectyx is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'intellectyx')

  assert.ok(scraper, 'Expected buildScrapers() to return the Intellectyx scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intellectyx')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.intellectyx.com/careers/')
  assert.match(scraper.dryRunFile, /intellectyx[\\/]jobs\.json$/i)
})
