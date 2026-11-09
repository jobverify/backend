import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('HNG is registered against the verified first-party current vacancies page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hindusthannationalglassandindustrieslimited')

  assert.ok(provider, 'Expected Hindusthan National Glass & Industries Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hindusthan National Glass & Industries Limited')
  assert.equal(provider.companyCareerPage, 'https://www.hngil.com/p/current-vacancies-1')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-inline-vacancies-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-inline-vacancies-table+no-public-detail-or-application-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hngil.com')
  assert.match(provider.modulePath, /hindusthannationalglassandindustrieslimited[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Hindusthan National Glass & Industries Limited'),
    false,
  )
})

test('HNG matches company coverage directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Hindusthan National Glass & Industries Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Hindusthan National Glass & Industries Limited',
      'hindusthannationalglassandindustrieslimited',
      'Hindusthan National Glass & Industries Limited',
    ]],
  )
})

test('HNG is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hindusthannationalglassandindustrieslimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the HNG scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hindusthannationalglassandindustrieslimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.hngil.com/p/current-vacancies-1')
  assert.match(scraper.dryRunFile, /hindusthannationalglassandindustrieslimited[\\/]jobs\.json$/i)
})
