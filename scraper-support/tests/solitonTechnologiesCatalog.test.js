import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Soliton Technologies as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'solitontechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Soliton Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.solitontech.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(
    provider.extractionStrategy,
    'public-html-cards+detail-pages+same-page-apply-state',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'solitontech.com')
  assert.match(provider.modulePath, /solitontechnologies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Soliton Technologies to the solitontechnologies source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'solitontechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /solitontechnologies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'solitontechnologies')

  const report = generateCompanyCoverageReport({
    csvText: 'Soliton Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Soliton Technologies', 'solitontechnologies', 'Soliton Technologies']],
  )
})
