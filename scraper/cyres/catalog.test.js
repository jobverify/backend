import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CYRES is registered as a verified first-party no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cyres')

  assert.ok(provider, 'Expected CYRES provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CYRES')
  assert.equal(provider.companyCareerPage, 'https://www.cyres.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'bare-domain-redirect-plus-homepage-connect-privacy-sitemaps-and-missing-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-bare-domain-redirect+verified-homepage+verified-connect-page+verified-privacy-page+verified-sitemap-index-and-page-sitemap-without-careers+verified-missing-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cyres.com')
  assert.match(provider.modulePath, /cyres[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CYRES'), false)
})

test('CYRES resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CYRES,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CYRES', 'cyres', 'CYRES']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'cyres')

  assert.ok(scraper, 'Expected buildScrapers() to return the CYRES sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cyres')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.cyres.com/')
  assert.match(scraper.dryRunFile, /cyres[\\/]jobs\.json$/i)
})
