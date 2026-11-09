import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Alchemy Techsol India Pvt Ltd as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alchemytechsolindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Alchemy Techsol India Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://alchemytechsol.com/career/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'alchemytechsol.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /alchemytechsolindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Alchemy Techsol India Pvt Ltd to the alchemytechsolindia source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'alchemytechsolindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /alchemytechsolindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'alchemytechsolindia')

  const report = generateCompanyCoverageReport({
    csvText: 'Alchemy Techsol India Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alchemy Techsol India Pvt Ltd', 'alchemytechsolindia', 'Alchemy Techsol India Pvt Ltd']],
  )
})
