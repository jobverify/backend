import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'synapserobotics'
const COMPANY = 'Synapse Robotics'
const HOMEPAGE_URL = 'https://synapserobotics.ai/'
const CHECKED_ROUTE_URLS = [
  'https://synapserobotics.ai/careers',
  'https://synapserobotics.ai/careers/',
  'https://synapserobotics.ai/jobs',
  'https://synapserobotics.ai/jobs/',
  'https://synapserobotics.ai/join-us',
  'https://synapserobotics.ai/join-us/',
  'https://synapserobotics.ai/work-with-us',
  'https://synapserobotics.ai/openings',
]

test('Synapse Robotics is registered as a verified first-party route-fallback sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Synapse Robotics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, CHECKED_ROUTE_URLS)
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-fallbacks')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-route-shell-fallbacks+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'synapserobotics.ai')
  assert.match(provider.modulePath, /synapserobotics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Synapse Robotics resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Synapse Robotics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Synapse Robotics', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Synapse Robotics sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /synapserobotics[\\/]jobs\.json$/i)
})
