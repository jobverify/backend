import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Yespeal Technologies is registered as an unresolved first-party sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yespealtechnologies')

  assert.ok(provider, 'Expected Yespeal Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Yespeal Technologies')
  assert.equal(provider.companyCareerPage, null)
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-hosts-and-careers-routes-resolution-validation')
  assert.equal(provider.extractionStrategy, 'verified-candidate-first-party-hosts-unresolved-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, null)
  assert.match(provider.modulePath, /yespealtechnologies[\\/]script\.js$/i)
})

test('Yespeal Technologies matches company coverage and builds through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Yespeal Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Yespeal Technologies', 'yespealtechnologies', 'Yespeal Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'yespealtechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Yespeal Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yespealtechnologies')
  assert.equal(scraper.provider.companyName, 'Yespeal Technologies')
  assert.match(scraper.dryRunFile, /yespealtechnologies[\\/]jobs\.json$/i)
})
