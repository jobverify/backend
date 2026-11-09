import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Poshmark as an exact-name zero-jobs script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'poshmark')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Poshmark')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://poshmark.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'poshmark.com')
  assert.match(provider.modulePath, /poshmark[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Poshmark without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'poshmark')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /poshmark[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'poshmark')

  const report = generateCompanyCoverageReport({
    csvText: 'Poshmark,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Poshmark', 'poshmark', 'Poshmark']],
  )
})
