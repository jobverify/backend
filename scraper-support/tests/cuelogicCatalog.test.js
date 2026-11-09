import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { CUELOGIC_CATALOG, VERIFIED_SURFACE_SUMMARY } from '../../scraper/cuelogic/catalog.js'

test('Cuelogic local catalog points to the verified LTM Ripplehire India board', () => {
  assert.equal(CUELOGIC_CATALOG.source, 'cuelogic')
  assert.equal(CUELOGIC_CATALOG.companyName, 'Cuelogic')
  assert.equal(CUELOGIC_CATALOG.companyCareerPage, 'https://www.ltm.com/careers')
  assert.match(CUELOGIC_CATALOG.boardUrl, /ltimindtree\.ripplehire\.com/)
  assert.equal(CUELOGIC_CATALOG.atsPlatform, 'ripplehire-empty-search-sentinel')
  assert.equal(CUELOGIC_CATALOG.verifiedOn, '2026-10-03')
  assert.match(VERIFIED_SURFACE_SUMMARY, /zero roles/i)
})

test('Cuelogic remains registered as a separate parent-board search source', () => {
  const provider = getScraperCatalog().find(item => item.source === 'cuelogic')
  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ltm.com/careers')
  assert.equal(provider.atsPlatform, 'ripplehire-empty-search-sentinel')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'parent-board-search-query')
  assert.equal(provider.companyDomain, 'ltm.com')
  assert.match(provider.modulePath, /cuelogic[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Cuelogic rows', () => {
  const scraper = buildScrapers().find(item => item.name === 'cuelogic')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cuelogic')
  assert.match(scraper.dryRunFile, /cuelogic[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({ csvText: 'Cuelogic,\n', catalog: getScraperCatalog() })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map(item => [item.companyName, item.source, item.provider?.companyName ?? null]), [['Cuelogic', 'cuelogic', 'Cuelogic']])
})
