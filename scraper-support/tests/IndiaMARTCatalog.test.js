import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'
import { selectScrapersForRun } from '../runner.js'

// IndiaMART is retired. These are current catalog/selection contracts, not
// renewed evidence about the former Klimb board or its historical verification.
const originalBacklogCsv = 'IndiaMART\n'

test('retired IndiaMART has no active catalog entry or catalog route to its former module', () => {
  const catalog = getScraperCatalog()
  assert.deepEqual(catalog.filter(provider => String(provider.source).toLowerCase() === 'indiamart'), [])
  assert.deepEqual(catalog.filter(provider => /[\\/]scraper[\\/]indiamart[\\/]script\.js$/i.test(provider.modulePath || '')), [])
})

test('retired IndiaMART backlog stays unmatched while controlled catalog hydration and exact-name lookup still work', () => {
  const report = generateCompanyCoverageReport({ csvText: originalBacklogCsv, catalog: getScraperCatalog(), aliasMap: {} })
  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(report.unmatched.map(row => row.companyName), ['IndiaMART'])

  // This explicit unit catalog is never registered or executed as a source.
  const input = Object.freeze({ source: 'controlled-catalog-fixture', companyName: 'Controlled Coverage Employer',
    adapter: 'script', companyCareerPage: 'https://careers.example.test/', companyDomain: 'example.test',
    countryFilter: null, exactCompanyMatchOnly: true })
  const controlled = hydrateProviderCatalogEntry(input)
  assert.equal(controlled.source, input.source)
  assert.equal(controlled.companyName, input.companyName)
  assert.equal(controlled.companyDomain, 'example.test')
  assert.equal(controlled.countryFilter, null)
  assert.equal(controlled.zeroResultPolicy, 'evidence-required')
  assert.equal(controlled.verifiedOn, undefined)
  assert.equal(controlled.verifiedPublicJobCount, undefined)
  assert.equal(path.isAbsolute(controlled.modulePath), true)
  const positive = generateCompanyCoverageReport({ csvText: 'Controlled Coverage Employer\n', catalog: [controlled], aliasMap: {} })
  assert.equal(positive.matchedCount, 1)
  assert.equal(positive.unmatchedCount, 0)
  assert.deepEqual(positive.matched.map(row => [row.companyName, row.source]), [[input.companyName, input.source]])
})

test('real runner selection rejects retired IndiaMART before any source runs and still selects an active control', () => {
  let runCalls = 0
  const scrapers = buildScrapers().map(scraper => ({ ...scraper, run() { runCalls++; throw new Error('Selection must not execute a source') } }))
  const options = { startAt: '', startAfter: '', firstN: '', dryRun: true }
  for (const onlySources of ['indiamart', 'IndiaMART']) {
    assert.throws(() => selectScrapersForRun(scrapers, { ...options, onlySources }), /SCRAPER_ONLY source\(s\) not found in the scraper catalog: indiamart/)
  }
  assert.ok(scrapers.length > 0)
  const selected = selectScrapersForRun(scrapers, { ...options, onlySources: scrapers[0].name })
  assert.deepEqual(selected.scrapers.map(scraper => scraper.name), [scrapers[0].name])
  assert.equal(typeof selected.scrapers[0].run, 'function')
  assert.equal(runCalls, 0)
})
