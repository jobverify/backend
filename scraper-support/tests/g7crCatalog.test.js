import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes G7 CR Technologies with the official careers handoff and narrow aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'g7cr')

  assert.ok(provider)
  assert.equal(provider.companyName, 'G7 CR Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://noventiqai.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-sitemap')
  assert.equal(provider.extractionStrategy, 'official-landing+hardened-sitemap+detail-anchor-apply-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'noventiqai.com')
  assert.match(provider.modulePath, /g7cr[\\/]script\.js$/i)
  assert.equal(companyAliases['G7 CR Technologies'], 'g7cr')
  assert.equal(companyAliases['G7CR Technologies'], 'g7cr')
  assert.equal(companyAliases['G7 CR'], 'g7cr')
  assert.equal(companyAliases.G7CR, 'g7cr')
})

test('buildScrapers and company coverage resolve G7 CR Technologies to the g7cr source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'g7cr')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /g7cr[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'g7cr')

  const report = generateCompanyCoverageReport({
    csvText: 'G7 CR Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['G7 CR Technologies', 'g7cr', 'G7 CR Technologies']],
  )
})
