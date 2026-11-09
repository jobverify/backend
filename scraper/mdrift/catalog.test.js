import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('mDrift is registered as a verified first-party zero-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mdrift')

  assert.ok(provider, 'Expected mDrift provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'mDrift Technologies')
  assert.equal(provider.companyCareerPage, 'https://mdrift.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-first-party-script-plus-missing-robots-sitemap-and-careers-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-empty-script+verified-missing-robots-sitemap-and-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mdrift.com')
  assert.match(provider.modulePath, /mdrift[\\/]script\.js$/i)
})

test('mDrift resolves directly from provider metadata and stays runnable through the scraper catalog without an alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'mDrift,\nmDrift Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['mDrift', 'mdrift', 'mDrift Technologies'],
      ['mDrift Technologies', 'mdrift', 'mDrift Technologies'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'mdrift')

  assert.ok(scraper, 'Expected buildScrapers() to return the mDrift sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mdrift')
  assert.equal(scraper.provider.companyCareerPage, 'https://mdrift.com/')
  assert.match(scraper.dryRunFile, /mdrift[\\/]jobs\.json$/i)
})
