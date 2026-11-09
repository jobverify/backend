import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Cybersecurity-NxxT is registered as a verified first-party zero-public-careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cybersecuritynxxt')

  assert.ok(provider, 'Expected Cybersecurity-NxxT provider in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cybersecurity-NxxT')
  assert.equal(provider.companyCareerPage, 'https://cybersecurity-nxxt.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-robots-plus-sitemap-plus-common-careers-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-missing-robots-and-sitemap+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cybersecurity-nxxt.com')
  assert.match(provider.modulePath, /cybersecuritynxxt[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Cybersecurity-NxxT'), false)
})

test('Cybersecurity-NxxT matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Cybersecurity-NxxT,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cybersecurity-NxxT', 'cybersecuritynxxt', 'Cybersecurity-NxxT']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'cybersecuritynxxt')

  assert.ok(scraper, 'Expected buildScrapers() to return the Cybersecurity-NxxT scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cybersecuritynxxt')
  assert.equal(scraper.provider.companyCareerPage, 'https://cybersecurity-nxxt.com/')
  assert.match(scraper.dryRunFile, /cybersecuritynxxt[\\/]jobs\.json$/i)
})
