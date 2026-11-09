import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes GxP Technologies India Pvt. Ltd. as a verified zero-job first-party scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gxptechnologiesindiapvtltd')

  assert.ok(provider, 'Expected GxP Technologies India Pvt. Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GxP Technologies India Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://gxptechnologies.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-route-shells+no-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gxptechnologies.com')
  assert.match(provider.modulePath, /gxptechnologiesindiapvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GxP Technologies India Pvt. Ltd.'), false)
})

test('GxP Technologies India Pvt. Ltd. matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GxP Technologies India Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GxP Technologies India Pvt. Ltd.', 'gxptechnologiesindiapvtltd', 'GxP Technologies India Pvt. Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'gxptechnologiesindiapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the GxP Technologies India Pvt. Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gxptechnologiesindiapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://gxptechnologies.com/')
  assert.match(scraper.dryRunFile, /gxptechnologiesindiapvtltd[\\/]jobs\.json$/i)
})
