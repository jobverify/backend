import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tessolve as an official-site Darwinbox script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tessolve')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tessolve')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.tessolve.com/careers/')
  assert.equal(provider.companyDomain, 'tessolve.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(provider.extractionStrategy, 'verified-official-handoff+complete-public-darwinbox-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://tessolve.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main')
  assert.match(provider.modulePath, /tessolve[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve both Tessolve company-name variants to the tessolve source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tessolve')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tessolve[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tessolve')

  const report = generateCompanyCoverageReport({
    csvText: 'Tessolve,\nTessolve Semiconductor Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Tessolve', 'tessolve', 'Tessolve'],
      ['Tessolve Semiconductor Pvt Ltd', 'tessolve', 'Tessolve'],
    ],
  )
})
