import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Arcadia as an official first-party Rippling apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const arcadia = catalog.find((provider) => provider.source === 'arcadia')

  assert.ok(arcadia)
  assert.equal(arcadia.adapter, 'apiPortal')
  assert.equal(arcadia.atsPlatform, 'official-company-careers-rippling-api')
  assert.equal(arcadia.companyCareerPage, 'https://www.arcadia.com/careers')
  assert.equal(arcadia.companyDomain, 'arcadia.com')
  assert.equal(arcadia.config.discovery.listingApiUrl, 'https://www.arcadia.com/api/rippling-jobs')
})

test('buildScrapers and company coverage resolve Arcadia to the arcadia source', () => {
  const arcadia = buildScrapers().find((scraper) => scraper.name === 'arcadia')

  assert.ok(arcadia)
  assert.equal(typeof arcadia.run, 'function')
  assert.match(arcadia.dryRunFile, /arcadia[\\/]jobs\.json$/)
  assert.equal(arcadia.provider.source, 'arcadia')
  assert.equal(arcadia.provider.atsPlatform, 'official-company-careers-rippling-api')

  const report = generateCompanyCoverageReport({
    csvText: 'Arcadia,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arcadia', 'arcadia', 'Arcadia']],
  )
})
