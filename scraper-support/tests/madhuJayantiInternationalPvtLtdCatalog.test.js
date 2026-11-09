import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Madhu Jayanti International Pvt Ltd is registered as a verified careers-shell zero-job sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'madhujayantiinternationalpvtltd')

  assert.ok(provider, 'Expected Madhu Jayanti International Pvt Ltd provider in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Madhu Jayanti International Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://jaytea.com/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jaytea.com')
  assert.match(provider.modulePath, /madhujayantiinternationalpvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Madhu Jayanti International Pvt Ltd'), false)
})

test('Madhu Jayanti International Pvt Ltd matches directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Madhu Jayanti International Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Madhu Jayanti International Pvt Ltd',
      'madhujayantiinternationalpvtltd',
      'Madhu Jayanti International Pvt Ltd',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'madhujayantiinternationalpvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Madhu Jayanti scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'madhujayantiinternationalpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://jaytea.com/careers.php')
  assert.match(scraper.dryRunFile, /madhujayantiinternationalpvtltd[\\/]jobs\.json$/i)
})
