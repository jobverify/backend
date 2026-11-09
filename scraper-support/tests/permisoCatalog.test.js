import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Permiso as an exact-name script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'permiso')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Permiso')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://permiso.io/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'permiso.io')
  assert.match(provider.modulePath, /permiso[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Permiso without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'permiso')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /permiso[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'permiso')

  const report = generateCompanyCoverageReport({
    csvText: 'Permiso,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Permiso', 'permiso', 'Permiso']],
  )
})
