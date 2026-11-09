import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sourcesys Technologies is registered as a verified first-party careers sentinel without alias requirements', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sourcesystechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sourcesys Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.sourcesys.co/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-missing-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-missing-first-party-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sourcesys.co')
  assert.match(provider.modulePath, /sourcesystechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sourcesys Technologies'), false)
})

test('Sourcesys Technologies resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sourcesys Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sourcesys Technologies', 'sourcesystechnologies', 'Sourcesys Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sourcesystechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sourcesystechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sourcesys.co/careers')
  assert.match(scraper.dryRunFile, /sourcesystechnologies[\\/]jobs\.json$/i)
})
