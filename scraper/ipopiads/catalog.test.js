import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ipopi Ads is registered as a verified first-party no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ipopiads')

  assert.ok(provider, 'Expected Ipopi Ads provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ipopi Ads')
  assert.equal(provider.companyCareerPage, 'https://www.ipopi.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'legacy-domain-redirect-plus-legal-pages-sitemap-and-missing-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-legacy-domain-redirect+verified-homepage+verified-privacy-page+verified-terms-page+verified-blog+verified-robots-and-sitemap-without-careers+verified-missing-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ipopi.in')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /sales@ipopi\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /Ipopi Ads Blog -/i)
  assert.match(provider.modulePath, /ipopiads[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ipopi Ads'), false)
})

test('Ipopi Ads resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ipopi Ads,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ipopi Ads', 'ipopiads', 'Ipopi Ads']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ipopiads')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ipopi Ads sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ipopiads')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ipopi.in/')
  assert.match(scraper.dryRunFile, /ipopiads[\\/]jobs\.json$/i)
})
