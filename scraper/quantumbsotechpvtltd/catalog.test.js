import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Quantum BSO & Tech Pvt. Ltd is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'quantumbsotechpvtltd')

  assert.ok(
    provider,
    'Expected Quantum BSO & Tech Pvt. Ltd provider to be registered in customProviders.json',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Quantum BSO & Tech Pvt. Ltd')
  assert.equal(provider.companyCareerPage, 'https://quantumbso.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-careers-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-careers-contact-handoff+verified-contact-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'quantumbso.com')
  assert.match(provider.modulePath, /quantumbsotechpvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Quantum BSO & Tech Pvt. Ltd'), false)
})

test('Quantum BSO & Tech Pvt. Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Quantum BSO & Tech Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Quantum BSO & Tech Pvt. Ltd', 'quantumbsotechpvtltd', 'Quantum BSO & Tech Pvt. Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'quantumbsotechpvtltd')

  assert.ok(
    scraper,
    'Expected buildScrapers() to return the Quantum BSO & Tech Pvt. Ltd sentinel scraper',
  )
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'quantumbsotechpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://quantumbso.com/')
  assert.match(scraper.dryRunFile, /quantumbsotechpvtltd[\\/]jobs\.json$/i)
})
