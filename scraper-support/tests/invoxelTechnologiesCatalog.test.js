import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Invoxel Technologies is registered against the verified official homepage careers surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'invoxeltechnologies')

  assert.ok(provider, 'Expected Invoxel Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Invoxel Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.invoxel.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-404-careers-route-plus-apply-only-careers-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-section+verified-no-public-careers-routes-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'invoxel.com')
  assert.match(provider.modulePath, /invoxeltechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Invoxel Technologies'), false)
})

test('Invoxel Technologies matches backlog coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Invoxel Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Invoxel Technologies', 'invoxeltechnologies', 'Invoxel Technologies']],
  )
})

test('Invoxel Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'invoxeltechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Invoxel Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'invoxeltechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.invoxel.com/')
  assert.match(scraper.dryRunFile, /invoxeltechnologies[\\/]jobs\.json$/i)
})
