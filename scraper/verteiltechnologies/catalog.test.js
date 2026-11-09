import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Verteil Technologies is registered as an official-careers scraper with explicit ZappyHire apply links', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'verteiltechnologies')

  assert.ok(provider, 'Expected Verteil Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Verteil Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.verteil.com/career')
  assert.equal(provider.atsPlatform, 'zappyhire-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+explicit-zappyhire-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'verteil.com')
  assert.match(provider.modulePath, /verteiltechnologies[\\/]script\.js$/i)
})

test('Verteil Technologies resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Verteil Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Verteil Technologies', 'verteiltechnologies', 'Verteil Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'verteiltechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Verteil Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'verteiltechnologies')
  assert.equal(scraper.provider.companyName, 'Verteil Technologies')
  assert.match(scraper.dryRunFile, /verteiltechnologies[\\/]jobs\.json$/i)
})
