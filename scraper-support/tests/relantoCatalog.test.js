import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Relanto is registered as a first-party careers handoff to a verified Keka jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'relanto')

  assert.ok(provider, 'Expected Relanto provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Relanto')
  assert.equal(provider.companyCareerPage, 'https://www.relanto.ai/careers')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-handoff-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-handoff+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'relanto.ai')
  assert.match(provider.modulePath, /relanto[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Relanto'), false)
})

test('Relanto matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Relanto,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Relanto', 'relanto', 'Relanto']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'relanto')

  assert.ok(scraper, 'Expected buildScrapers() to return the Relanto scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'relanto')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.relanto.ai/careers')
  assert.match(scraper.dryRunFile, /relanto[\\/]jobs\.json$/i)
})
