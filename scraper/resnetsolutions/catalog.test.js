import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('ResNet Solutions is registered as an official-site empty-sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'resnetsolutions')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ResNet Solutions Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.resnetsolution.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'resnetsolution.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /resnetsolutions[\\/]script\.js$/i)
})

test('ResNet Solutions matches the extracted CSV company row directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ResNet Solutions Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ResNet Solutions Private Limited', 'resnetsolutions', 'ResNet Solutions Private Limited']],
  )
})

test('ResNet Solutions remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'resnetsolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /resnetsolutions[\\/]jobs\.json$/i)
})
