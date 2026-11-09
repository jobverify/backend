import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('K7 Computing is registered against its first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'k7computing')

  assert.ok(provider, 'Expected K7 Computing provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'K7 Computing')
  assert.equal(provider.companyCareerPage, 'https://careers.k7computing.com/')
  assert.equal(provider.atsPlatform, 'k7-computing-first-party-careers')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /k7computing[\\/]script\.js$/i)
})

test('K7 Computing matches company coverage and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'K7 Computing,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['K7 Computing', 'k7computing'],
  ])

  const scraper = buildScrapers().find((item) => item.name === 'k7computing')
  assert.ok(scraper)
  assert.equal(scraper.provider.source, 'k7computing')
  assert.match(scraper.dryRunFile, /k7computing[\\/]jobs\.json$/i)
})
