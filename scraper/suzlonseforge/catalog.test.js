import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Suzlon-SE Forge is registered as a verified first-party non-listing careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'suzlonseforge')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Suzlon-SE Forge')
  assert.equal(provider.companyCareerPage, 'https://www.suzlon.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-missing-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-missing-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'suzlon.com')
  assert.match(provider.modulePath, /suzlonseforge[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Suzlon-SE Forge'), false)
})

test('Suzlon-SE Forge matches company coverage directly from provider metadata and stays runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Suzlon-SE Forge\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Suzlon-SE Forge', 'suzlonseforge', 'Suzlon-SE Forge']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'suzlonseforge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'suzlonseforge')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.suzlon.com/careers/')
  assert.match(scraper.dryRunFile, /suzlonseforge[\\/]jobs\.json$/i)
})
