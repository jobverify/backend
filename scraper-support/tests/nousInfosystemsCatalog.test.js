import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Nous Infosystems is registered as a verified first-party rebrand scraper with public Artizent openings and no aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nousinfosystems')

  assert.ok(provider, 'Expected Nous Infosystems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nous Infosystems')
  assert.equal(provider.companyCareerPage, 'https://www.artizent.com/insights/careers')
  assert.equal(provider.officialBrandName, 'Artizent')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'legacy-domain-redirect-plus-first-party-careers-shell-plus-js-jobs-asset')
  assert.equal(
    provider.extractionStrategy,
    'verified-nous-domain-redirect+verified-artizent-careers-shell+first-party-openings-assets+structured-jobs-asset',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'artizent.com')
  assert.match(provider.modulePath, /nousinfosystems[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /14 public India jobs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nous Infosystems'), false)
})

test('Nous Infosystems matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Nous Infosystems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nous Infosystems', 'nousinfosystems', 'Nous Infosystems']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'nousinfosystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the Nous Infosystems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nousinfosystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.artizent.com/insights/careers')
  assert.match(scraper.dryRunFile, /nousinfosystems[\\/]jobs\.json$/i)
})
