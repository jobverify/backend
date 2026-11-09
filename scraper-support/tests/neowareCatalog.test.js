import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Neoware is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neoware')

  assert.ok(provider, 'Expected Neoware provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Neoware')
  assert.equal(provider.companyCareerPage, 'https://www.neoware.io/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-404-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-first-party-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'neoware.io')
  assert.match(provider.modulePath, /neoware[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Neoware'), false)
})

test('Neoware resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Neoware,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Neoware', 'neoware', 'Neoware']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'neoware')

  assert.ok(scraper, 'Expected buildScrapers() to return the Neoware sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neoware')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.neoware.io/')
  assert.match(scraper.dryRunFile, /neoware[\\/]jobs\.json$/i)
})
