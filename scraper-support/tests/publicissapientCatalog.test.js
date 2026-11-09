import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Publicis Sapient as an iCIMS-backed custom provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const publicissapient = catalog.find((provider) => provider.source === 'publicissapient')

  assert.ok(publicissapient)
  assert.equal(publicissapient.adapter, 'script')
  assert.equal(publicissapient.atsPlatform, 'icims')
  assert.match(publicissapient.companyCareerPage, /careers\.publicissapient\.com\/job-search/i)
  assert.equal(publicissapient.companyDomain, 'careers.publicissapient.com')
})

test('Publicis Sapient coverage resolves the legacy Sapient backlog name through the shared alias map', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'publicissapient')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Publicis Sapient')
  assert.equal(companyAliases.Sapient, 'publicissapient')

  const report = generateCompanyCoverageReport({
    csvText: 'Publicis Sapient\nSapient\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Publicis Sapient', 'publicissapient', 'Publicis Sapient'],
      ['Sapient', 'publicissapient', 'Publicis Sapient'],
    ],
  )
})

test('buildScrapers exposes a runnable Publicis Sapient scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const publicissapient = scrapers.find((scraper) => scraper.name === 'publicissapient')

  assert.ok(publicissapient)
  assert.equal(typeof publicissapient.run, 'function')
  assert.match(publicissapient.dryRunFile, /publicissapient[\\/]jobs\.json$/)
  assert.equal(publicissapient.provider.source, 'publicissapient')
})
