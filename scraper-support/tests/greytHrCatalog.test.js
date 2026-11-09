import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('GreytHR is registered against its official careers and jobs surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'greythr')

  assert.ok(provider, 'Expected GreytHR provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Greytip Software')
  assert.equal(provider.companyCareerPage, 'https://www.greythr.com/company/careers/')
  assert.equal(provider.atsPlatform, 'greytip-greythr-public-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /greythr[\\/]script\.js$/i)
})

test('GreytHR matches directly from provider metadata and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Greytip Software,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Greytip Software', 'greythr'],
  ])

  const scraper = buildScrapers().find((item) => item.name === 'greythr')
  assert.ok(scraper)
  assert.equal(scraper.provider.source, 'greythr')
  assert.match(scraper.dryRunFile, /greythr[\\/]jobs\.json$/i)
})
