import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('aiRender Technology Pvt Ltd is registered as a verified first-party missing-careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airendertechnologypvtltd')

  assert.ok(provider, 'Expected aiRender Technology Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'aiRender Technology Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://airender.co.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-client-bundle-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-client-bundle-company-identity+verified-no-public-careers-route-surfaces-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'airender.co.in')
  assert.match(provider.modulePath, /airendertechnologypvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'aiRender Technology Pvt Ltd'), false)
})

test('aiRender Technology Pvt Ltd matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'aiRender Technology Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['aiRender Technology Pvt Ltd', 'airendertechnologypvtltd', 'aiRender Technology Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'airendertechnologypvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the aiRender Technology Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'airendertechnologypvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://airender.co.in/')
  assert.match(scraper.dryRunFile, /airendertechnologypvtltd[\\/]jobs\.json$/i)
})
