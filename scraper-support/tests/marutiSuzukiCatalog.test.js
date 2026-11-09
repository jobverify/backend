import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Maruti Suzuki as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'marutisuzuki')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Maruti Suzuki India Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.marutisuzuki.com/corporate/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'marutisuzuki.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /marutisuzuki[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Maruti Suzuki without requiring a new alias', () => {
  const scraper = buildScrapers().find((item) => item.name === 'marutisuzuki')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /marutisuzuki[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'marutisuzuki')

  const report = generateCompanyCoverageReport({
    csvText: 'Maruti Suzuki,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Maruti Suzuki', 'marutisuzuki', 'Maruti Suzuki India Limited']],
  )
})
