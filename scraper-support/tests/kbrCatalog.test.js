import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes the KBR first-party snapshot script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const kbr = catalog.find((provider) => provider.source === 'kbr')

  assert.ok(kbr)
  assert.equal(kbr.adapter, 'script')
  assert.equal(kbr.atsPlatform, 'official-company-workday-snapshot')
  assert.equal(kbr.companyCareerPage, 'https://jobs.kbr.com/jobs.html')
  assert.equal(kbr.companyDomain, 'jobs.kbr.com')
  assert.match(kbr.modulePath, /kbr[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable KBR scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const kbr = scrapers.find((scraper) => scraper.name === 'kbr')

  assert.ok(kbr)
  assert.equal(typeof kbr.run, 'function')
  assert.match(kbr.dryRunFile, /kbr[\\/]jobs\.json$/)
  assert.equal(kbr.provider.source, 'kbr')
  assert.equal(kbr.provider.atsPlatform, 'official-company-workday-snapshot')
})

test('company coverage resolves the Kellog Brown & Roots Engineering and Construction backlog row to KBR', () => {
  assert.equal(companyAliases['Kellog Brown & Roots Engineering and Construction'], 'kbr')

  const report = generateCompanyCoverageReport({
    csvText: 'Kellog Brown & Roots Engineering and Construction,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Kellog Brown & Roots Engineering and Construction', 'kbr', 'kbr']],
  )
})
