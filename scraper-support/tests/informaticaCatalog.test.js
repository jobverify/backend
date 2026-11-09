import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Informatica is registered as a verified first-party redirect-only zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'informatica')

  assert.ok(provider, 'Expected Informatica provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Informatica')
  assert.equal(provider.companyCareerPage, 'https://www.informatica.com/about-us/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers-redirect')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-redirect-handoff-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-redirect-to-salesforce-jobs-shell-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'informatica.com')
  assert.match(provider.modulePath, /informatica[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Informatica'), false)
})

test('Informatica matches company coverage directly from provider metadata and is runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Informatica,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Informatica', 'informatica', 'Informatica']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'informatica')

  assert.ok(scraper, 'Expected buildScrapers() to return the Informatica scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'informatica')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.informatica.com/about-us/careers.html')
  assert.match(scraper.dryRunFile, /informatica[\\/]jobs\.json$/i)
})
