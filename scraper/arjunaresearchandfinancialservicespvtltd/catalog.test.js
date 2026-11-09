import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Arjuna Research and Financial Services Pvt Ltd is registered as a verified unresolved-first-party-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arjunaresearchandfinancialservicespvtltd')

  assert.ok(provider, 'Expected Arjuna Research and Financial Services Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Arjuna Research and Financial Services Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://arjunaresearch.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'arjunaresearch.com')
  assert.match(provider.modulePath, /arjunaresearchandfinancialservicespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Arjuna Research and Financial Services Pvt Ltd'), false)
})

test('Arjuna Research and Financial Services Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Arjuna Research and Financial Services Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arjuna Research and Financial Services Pvt Ltd', 'arjunaresearchandfinancialservicespvtltd', 'Arjuna Research and Financial Services Pvt Ltd']],
  )
})

test('Arjuna Research and Financial Services Pvt Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'arjunaresearchandfinancialservicespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Arjuna Research and Financial Services Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'arjunaresearchandfinancialservicespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://arjunaresearch.com/')
  assert.match(scraper.dryRunFile, /arjunaresearchandfinancialservicespvtltd[\\/]jobs\.json$/i)
})
