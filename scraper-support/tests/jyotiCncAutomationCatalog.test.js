import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Jyoti CNC Automation as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jyoticncautomation')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Jyoti CNC Automation Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://jyoti.co.in/career/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-current-openings-page+inline-role-sections+shared-apply-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jyoti.co.in')
  assert.match(provider.modulePath, /jyoticncautomation[\\/]script\.js$/i)
})

test('Jyoti CNC Automation coverage matches the exact CSV rows tied to the same official careers surface', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jyoticncautomation')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /jyoticncautomation[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'jyoticncautomation')

  const report = generateCompanyCoverageReport({
    csvText: [
      'Jyoti CNC Automation,',
      'JYOTI CNC AUTOMATION LIMITED,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Jyoti CNC Automation', 'jyoticncautomation', 'Jyoti CNC Automation Limited'],
      ['JYOTI CNC AUTOMATION LIMITED', 'jyoticncautomation', 'Jyoti CNC Automation Limited'],
    ],
  )
})
