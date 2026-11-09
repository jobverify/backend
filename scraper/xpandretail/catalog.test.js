import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Xpandretail is registered as a verified official-site no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'xpandretail')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Xpandretail')
  assert.equal(provider.companyCareerPage, 'https://xpandretail.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-contact-legal-and-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page+verified-privacy-page+verified-terms-page+missing-public-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'xpandretail.com')
  assert.match(provider.modulePath, /xpandretail[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Xpandretail'), false)
})

test('Xpandretail resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Xpandretail,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Xpandretail', 'xpandretail', 'Xpandretail']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'xpandretail')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'xpandretail')
  assert.equal(scraper.provider.companyCareerPage, 'https://xpandretail.com/')
  assert.match(scraper.dryRunFile, /xpandretail[\\/]jobs\.json$/i)
})
