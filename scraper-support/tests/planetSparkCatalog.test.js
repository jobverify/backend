import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes PlanetSpark as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'planetspark')

  assert.ok(provider)
  assert.equal(provider.companyName, 'PlanetSpark')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.planetspark.in/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'planetspark.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /planetspark[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve PlanetSpark without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'planetspark')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /planetspark[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'planetspark')

  const report = generateCompanyCoverageReport({
    csvText: 'PlanetSpark,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PlanetSpark', 'planetspark', 'PlanetSpark']],
  )
})
