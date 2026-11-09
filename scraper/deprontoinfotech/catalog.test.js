import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('DePronto InfoTech is registered with the verified hash-routed careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deprontoinfotech')

  assert.ok(provider, 'Expected DePronto InfoTech provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'DePronto InfoTech')
  assert.equal(provider.companyCareerPage, 'https://deprontoinfotech.com/#/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-react-bundle')
  assert.equal(provider.extractionStrategy, 'verified-react-shell+verified-careers-bundle+bundled-role-cards+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'deprontoinfotech.com')
  assert.match(provider.modulePath, /deprontoinfotech[\\/]script\.js$/i)
})

test('DePronto InfoTech matches company coverage directly from the CSV row', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'DePronto InfoTech,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DePronto InfoTech', 'deprontoinfotech', 'DePronto InfoTech']],
  )
})

test('DePronto InfoTech is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'deprontoinfotech')

  assert.ok(scraper, 'Expected buildScrapers() to return the DePronto InfoTech scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'deprontoinfotech')
  assert.equal(scraper.provider.companyCareerPage, 'https://deprontoinfotech.com/#/careers')
  assert.match(scraper.dryRunFile, /deprontoinfotech[\\/]jobs\.json$/i)
})
