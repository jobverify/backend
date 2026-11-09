import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const SOURCE = 'nhost'
const COMPANY = 'Nhost'
const CAREERS_URL = 'https://nhost.io/careers'

test('Nhost is registered directly against the verified first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Nhost provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-inline-role-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-role-pages+global-remote-role-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nhost.io')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.match(provider.modulePath, /nhost[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nhost[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nhost\.io\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer, Backend & Operations/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Nhost matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nNhost\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('Nhost is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Nhost scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /nhost[\\/]jobs\.json$/i)
})
