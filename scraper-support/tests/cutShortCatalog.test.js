import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'
import providerContract from '../../scraper/cutshort/provider.json' with { type: 'json' }

test('getScraperCatalog includes CutShort as a verified first-party company-page scraper', () => {
  const expectedProvider = hydrateProviderCatalogEntry(providerContract)
  const provider = getScraperCatalog().find((item) => item.source === 'cutshort')

  assert.ok(provider)
  assert.equal(provider.source, 'cutshort')
  assert.equal(provider.companyName, 'CutShort')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://cutshort.io/company/cutshort-zFdWQxlN')
  assert.equal(provider.atsPlatform, 'cutshort-first-party-company-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-plus-first-party-company-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+official-cutshort-company-page-next-data-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cutshort.io')
  assert.match(provider.modulePath, /cutshort[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cutshort[\\/]jobs\.json$/i)

  assert.equal(expectedProvider.source, provider.source)
  assert.equal(expectedProvider.companyName, provider.companyName)
  assert.equal(expectedProvider.companyCareerPage, provider.companyCareerPage)
  assert.equal(expectedProvider.companyDomain, provider.companyDomain)
})

test('buildScrapers and company coverage resolve CutShort from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cutshort')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cutshort')
  assert.match(scraper.dryRunFile, /cutshort[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'CutShort\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CutShort', 'cutshort', 'CutShort']],
  )
})
