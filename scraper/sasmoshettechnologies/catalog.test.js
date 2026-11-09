import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('SASMOS HET TECHNOLOGIES is registered against the verified official careers shell', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sasmoshettechnologies')

  assert.ok(provider, 'Expected SASMOS HET TECHNOLOGIES provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SASMOS HET TECHNOLOGIES')
  assert.equal(provider.companyCareerPage, 'https://sasmos.com/join-our-team/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-join-team-page-plus-empty-subpages')
  assert.equal(provider.extractionStrategy, 'official-join-team-page+verified-empty-open-positions-and-profile-shells')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sasmos.com')
  assert.match(provider.modulePath, /sasmoshettechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SASMOS HET TECHNOLOGIES'), false)
})

test('SASMOS HET TECHNOLOGIES matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SASMOS HET TECHNOLOGIES,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['SASMOS HET TECHNOLOGIES', 'sasmoshettechnologies'],
  ])
})

test('SASMOS HET TECHNOLOGIES is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sasmoshettechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the SASMOS HET TECHNOLOGIES scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sasmoshettechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://sasmos.com/join-our-team/')
  assert.match(scraper.dryRunFile, /sasmoshettechnologies[\\/]jobs\.json$/i)
})
