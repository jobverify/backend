import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Zee Entertainment Enterprises is registered on the official careers page with a SenseHQ jobs handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zeeentertainmententerprises')

  assert.ok(provider, 'Expected Zee Entertainment Enterprises provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Zee Entertainment Enterprises Limited')
  assert.equal(provider.companyCareerPage, 'https://www.zee.com/careers/')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'zero-based-page-query+stable-native-total+unique-IDs')
  assert.equal(provider.extractionStrategy, 'current-corporate-handoff+identity-bound-native-details+separate-description-health')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'zee.com')
  assert.match(provider.modulePath, /zeeentertainmententerprises[\\/]script\.js$/i)
})

test('Zee Entertainment Enterprises coverage resolves both the legal company name and the backlog alias while keeping the runner contract unchanged', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Zee Entertainment Enterprises,\nZee Entertainment Enterprises Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Zee Entertainment Enterprises', 'zeeentertainmententerprises', 'Zee Entertainment Enterprises Limited'],
      ['Zee Entertainment Enterprises Limited', 'zeeentertainmententerprises', 'Zee Entertainment Enterprises Limited'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'zeeentertainmententerprises')

  assert.ok(scraper, 'Expected buildScrapers() to return the Zee Entertainment Enterprises scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'zeeentertainmententerprises')
  assert.equal(scraper.provider.atsPlatform, 'sensehq')
  assert.match(scraper.dryRunFile, /zeeentertainmententerprises[\\/]jobs\.json$/i)
})
