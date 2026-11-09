import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Diya Edulabs Pvt.Ltd. is registered as a verified unresolved-first-party-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'diyaedulabspvtltd')

  assert.ok(provider, 'Expected Diya Edulabs Pvt.Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Diya Edulabs Pvt.Ltd.')
  assert.equal(provider.companyCareerPage, 'https://diyaedulabs.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'diyaedulabs.com')
  assert.match(provider.modulePath, /diyaedulabspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Diya Edulabs Pvt.Ltd.'), false)
})

test('Diya Edulabs Pvt.Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Diya Edulabs Pvt.Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Diya Edulabs Pvt.Ltd.', 'diyaedulabspvtltd', 'Diya Edulabs Pvt.Ltd.']],
  )
})

test('Diya Edulabs Pvt.Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'diyaedulabspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Diya Edulabs Pvt.Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'diyaedulabspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://diyaedulabs.com/')
  assert.match(scraper.dryRunFile, /diyaedulabspvtltd[\\/]jobs\.json$/i)
})
