import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes BharatX as a Workable markdown-feed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatx')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workable')
  assert.equal(provider.companyName, 'BharatX')
  assert.equal(provider.companyCareerPage, 'https://bharatx.tech/careers/')
  assert.equal(provider.companyDomain, 'bharatx.tech')
  assert.match(provider.modulePath, /bharatx[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BharatX to bharatx', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatx')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bharatx')
  assert.equal(scraper.provider.atsPlatform, 'workable')
  assert.match(scraper.dryRunFile, /bharatx[\\/]jobs\.json$/)

  const report = generateCompanyCoverageReport({
    csvText: 'BharatX,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['BharatX', 'bharatx', 'bharatx']],
  )
})
