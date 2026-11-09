import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes BimaKaro as a verified broken official host monitor', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bimakaro')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-broken-no-public-job-listings')
  assert.equal(provider.companyCareerPage, 'http://www.bimakaro.in/careers')
  assert.equal(provider.companyDomain, 'bimakaro.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bimakaro[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BimaKaro to bimakaro', () => {
  const provider = buildScrapers().find((scraper) => scraper.name === 'bimakaro')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.source, 'bimakaro')
  assert.match(provider.dryRunFile, /bimakaro[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'BimaKaro,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['BimaKaro', 'bimakaro', 'bimakaro']],
  )
})
