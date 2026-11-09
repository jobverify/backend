import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('NeuLeap is registered against the verified first-party careers section without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neuleap')

  assert.ok(provider, 'Expected NeuLeap provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NeuLeap')
  assert.equal(provider.companyCareerPage, 'https://neuleap.ai/#careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-homepage-plus-first-party-page-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-inline-careers-section+verified-first-party-page-bundle+structured-openings-array',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'neuleap.ai')
  assert.match(provider.modulePath, /neuleap[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NeuLeap'), false)
})

test('NeuLeap matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NeuLeap,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NeuLeap', 'neuleap', 'NeuLeap']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'neuleap')

  assert.ok(scraper, 'Expected buildScrapers() to return the NeuLeap scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neuleap')
  assert.equal(scraper.provider.companyCareerPage, 'https://neuleap.ai/#careers')
  assert.match(scraper.dryRunFile, /neuleap[\\/]jobs\.json$/i)
})
