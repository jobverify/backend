import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('xponent.ai is registered with full native own-page extraction and unqualified country/company totals', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'xponentai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'xponent.ai')
  assert.equal(provider.companyCareerPage, 'https://xponent.ai/career/')
  assert.equal(provider.atsPlatform, 'wp-job-openings-native-own-html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-REST-total-and-next-links;paired-complete-own-JSON-and-own-HTML')
  assert.equal(
    provider.extractionStrategy,
    'current-careers-native-plugin-and-REST-declaration;complete-published-post-models;full-own-visible-criteria;explicit-native-country',
  )
  assert.equal(provider.parser, 'live-parser')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'xponent.ai')
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.modulePath, /xponentai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'xponent.ai'), false)
})

test('xponent.ai resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'xponent.ai,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['xponent.ai', 'xponentai', 'xponent.ai']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'xponentai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'xponentai')
  assert.equal(scraper.provider.companyCareerPage, 'https://xponent.ai/career/')
  assert.match(scraper.dryRunFile, /xponentai[\\/]jobs\.json$/i)
})
