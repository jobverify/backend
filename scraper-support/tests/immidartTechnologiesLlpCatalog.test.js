import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Immidart Technologies LLP registers current own full native role criteria without alias churn or complete scope claims', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'immidarttechnologiesllp')

  assert.ok(provider, 'Expected Immidart Technologies LLP provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Immidart Technologies LLP')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.immidart.com/careers/')
  assert.equal(provider.atsPlatform, 'first-party-server-rendered-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.match(provider.paginationStrategy, /bounded|own|canonical/i)
  assert.match(provider.extractionStrategy, /full|authored|visible/i)
  assert.match(provider.extractionStrategy, /country/i)
  assert.match(provider.extractionStrategy, /employer/i)
  assert.match(provider.extractionStrategy, /clos/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedIndiaJobCount ?? null, null)
  assert.equal(provider.verifiedPublicJobCount ?? null, null)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'immidart.com')
  assert.match(provider.modulePath, /immidarttechnologiesllp[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Immidart Technologies LLP'), false)
})

test('Immidart Technologies LLP matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Immidart Technologies LLP,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Immidart Technologies LLP', 'immidarttechnologiesllp', 'Immidart Technologies LLP']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'immidarttechnologiesllp')

  assert.ok(scraper, 'Expected buildScrapers() to return the Immidart Technologies LLP scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'immidarttechnologiesllp')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.immidart.com/careers/')
  assert.match(scraper.dryRunFile, /immidarttechnologiesllp[\\/]jobs\.json$/i)
})
