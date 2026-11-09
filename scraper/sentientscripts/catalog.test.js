import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sentient Scripts is registered as an official-site empty-sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sentientscripts')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SENTIENT SCRIPTS PVT. LTD.')
  assert.equal(provider.companyCareerPage, 'https://www.sentientscripts.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'sentientscripts.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /sentientscripts[\\/]script\.js$/i)
})

test('Sentient Scripts matches the extracted CSV company row directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SENTIENT SCRIPTS PVT. LTD.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SENTIENT SCRIPTS PVT. LTD.', 'sentientscripts', 'SENTIENT SCRIPTS PVT. LTD.']],
  )
})

test('Sentient Scripts remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sentientscripts')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sentientscripts[\\/]jobs\.json$/i)
})
