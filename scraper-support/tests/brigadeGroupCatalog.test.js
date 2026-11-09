import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Brigade Group as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brigadegroup')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Brigade Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.brigadegroup.com/careers')
  assert.equal(provider.companyDomain, 'brigadegroup.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(provider.extractionStrategy, 'verified-official-handoff+complete-public-darwinbox-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://brigadegroup.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.match(provider.modulePath, /brigadegroup[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Brigade Group without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'brigadegroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /brigadegroup[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'brigadegroup')

  const report = generateCompanyCoverageReport({
    csvText: 'Brigade Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Brigade Group', 'brigadegroup', 'Brigade Group']],
  )
})
