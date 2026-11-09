import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Kovai.co as a Manatal-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kovaico')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'manatal')
  assert.equal(provider.companyName, 'Kovai.co')
  assert.equal(provider.companyCareerPage, 'https://careers.kovai.co/')
  assert.equal(provider.companyDomain, 'careers.kovai.co')
  assert.match(provider.modulePath, /kovaico[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Kovai.co scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kovaico')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kovaico')
  assert.equal(scraper.provider.atsPlatform, 'manatal')
  assert.match(scraper.dryRunFile, /kovaico[\\/]jobs\.json$/i)
})

test('company coverage resolves Kovai.co to the kovaico source without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kovai.co,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kovai.co', 'kovaico', 'Kovai.co']],
  )
})
