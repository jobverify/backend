import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('UHP Technologies is registered against the verified KAS Group and GreytHR contract', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'uhptechnologiespvtltd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'UHP Technologies Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://uhptech.com/careers/')
  assert.equal(provider.atsPlatform, 'greythr')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-kas-handoff-plus-greythr-published-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-uhp-careers-page+verified-kas-handoff+greythr-company-details+published-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'uhptech.com')
  assert.match(provider.modulePath, /uhptechnologiespvtltd[\\/]script\.js$/i)
})

test('UHP Technologies Pvt Ltd matches company coverage directly and stays runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'UHP Technologies Pvt Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['UHP Technologies Pvt Ltd', 'uhptechnologiespvtltd', 'UHP Technologies Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'uhptechnologiespvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'uhptechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://uhptech.com/careers/')
  assert.match(scraper.dryRunFile, /uhptechnologiespvtltd[\\/]jobs\.json$/i)
})
