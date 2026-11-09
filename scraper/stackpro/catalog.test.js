import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('StackPro is registered as a verified first-party site sentinel without alias requirements', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stackpro')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'StackPro')
  assert.equal(provider.companyCareerPage, 'https://stackpro.io/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://stackpro.io/careers',
    'https://stackpro.io/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-about-contact-robots-sitemap-and-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-nextjs-homepage+about+contact+robots+sitemap+bundles+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'stackpro.io')
  assert.match(provider.modulePath, /stackpro[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Stackpro'), false)
})

test('Stackpro resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Stackpro,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Stackpro', 'stackpro', 'StackPro']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'stackpro')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'stackpro')
  assert.equal(scraper.provider.companyCareerPage, 'https://stackpro.io/')
  assert.match(scraper.dryRunFile, /stackpro[\\/]jobs\.json$/i)
})
