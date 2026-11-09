import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Mentamind is registered as an official-site empty-sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mentamind')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mentamind')
  assert.equal(provider.companyCareerPage, 'https://mentamind.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'mentamind.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /mentamind[\\/]script\.js$/i)
})

test('Mentamind matches the extracted CSV company row directly through normalized company names', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mentamind Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mentamind Technologies', 'mentamind', 'Mentamind']],
  )
})

test('Mentamind remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mentamind')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mentamind[\\/]jobs\.json$/i)
})
