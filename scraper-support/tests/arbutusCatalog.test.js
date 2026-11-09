import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Arbutus is registered against its official Paylocity careers portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arbutus')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Arbutus Biopharma')
  assert.equal(
    provider.companyCareerPage,
    'https://recruiting.paylocity.com/recruiting/jobs/All/f2fda2c7-bfc6-4840-90d0-83d242cada87/Arbutus-Biopharma-Inc',
  )
  assert.equal(provider.atsPlatform, 'paylocity')
  assert.equal(provider.companyDomain, 'recruiting.paylocity.com')
})

test('Arbutus is runnable through the scraper provider catalog and resolves in company coverage', () => {
  const scraper = buildScrapers().find((item) => item.name === 'arbutus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /arbutus[\\/]jobs\.json$/)

  const report = generateCompanyCoverageReport({
    csvText: 'Arbutus,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arbutus', 'arbutus', 'Arbutus Biopharma']],
  )
})
