import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Prism RMC is registered against its verified first-party jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prismrmc')

  assert.ok(provider, 'Expected Prism RMC provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Prism RMC')
  assert.equal(provider.companyCareerPage, 'https://www.rmcindia.com/join-our-team/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-join-our-team-page-plus-wordpress-page-sitemap-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-join-our-team-page+inline-job-cards+same-domain-detail-pages+google-forms-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rmcindia.com')
  assert.match(provider.modulePath, /prismrmc[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Prism RMC'), false)
})

test('Prism RMC matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Prism RMC,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Prism RMC', 'prismrmc', 'Prism RMC']],
  )
})

test('Prism RMC is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'prismrmc')

  assert.ok(scraper, 'Expected buildScrapers() to return the Prism RMC scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prismrmc')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.rmcindia.com/join-our-team/')
  assert.match(scraper.dryRunFile, /prismrmc[\\/]jobs\.json$/i)
})
