import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Forensic CyberTech is registered as a verified first-party zero-public-careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'forensiccybertech')

  assert.ok(provider, 'Expected Forensic CyberTech provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Forensic CyberTech')
  assert.equal(provider.companyCareerPage, 'https://forensiccybertech.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-first-party-route-shell-bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-route-shell-bundles-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'forensiccybertech.com')
  assert.match(provider.modulePath, /forensiccybertech[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Forensic CyberTech'), false)
})

test('Forensic CyberTech matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Forensic CyberTech,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Forensic CyberTech', 'forensiccybertech', 'Forensic CyberTech']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'forensiccybertech')

  assert.ok(scraper, 'Expected buildScrapers() to return the Forensic CyberTech sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'forensiccybertech')
  assert.equal(scraper.provider.companyCareerPage, 'https://forensiccybertech.com/')
  assert.match(scraper.dryRunFile, /forensiccybertech[\\/]jobs\.json$/i)
})
