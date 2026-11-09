import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Opsera as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'opsera')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Opsera')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.opsera.io/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'opsera.io')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /opsera[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Opsera without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'opsera')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /opsera[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'opsera')

  const report = generateCompanyCoverageReport({
    csvText: 'Opsera,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Opsera', 'opsera', 'Opsera']],
  )
})
