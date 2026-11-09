import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Mudrex as a verified first-party about page plus public Manatal board provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mudrex')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mudrex')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'manatal-careers-page')
  assert.equal(provider.companyCareerPage, 'https://mudrex.com/about-us')
  assert.equal(provider.companyDomain, 'mudrex.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-about-page-plus-linked-manatal-board')
  assert.equal(provider.extractionStrategy, 'official-about-page+manatal-board+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /mudrex[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Mudrex without alias extensions', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mudrex')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mudrex[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'mudrex')

  const report = generateCompanyCoverageReport({
    csvText: 'Mudrex,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
