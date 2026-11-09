import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Silicon Microsystems is registered against the verified first-party published career bundle', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'siliconmicrosystems')

  assert.ok(provider, 'Expected Silicon Microsystems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Silicon Microsystems')
  assert.equal(provider.companyCareerPage, 'https://www.simsindia.net/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-main-bundle-plus-career-route-chunk')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+published-career-bundle+mailto-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'simsindia.net')
  assert.match(provider.modulePath, /siliconmicrosystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Silicon Microsystems'), false)
})

test('Silicon Microsystems matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Silicon Microsystems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Silicon Microsystems', 'siliconmicrosystems', 'Silicon Microsystems']],
  )
})

test('Silicon Microsystems is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'siliconmicrosystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the Silicon Microsystems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'siliconmicrosystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.simsindia.net/career')
  assert.match(scraper.dryRunFile, /siliconmicrosystems[\\/]jobs\.json$/i)
})
