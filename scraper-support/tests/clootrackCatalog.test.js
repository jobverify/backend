import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadClootrackModule = async () => {
  try {
    return await import('../../scraper/clootrack/script.js')
  } catch {
    assert.fail('Expected Clootrack scraper module at ../../scraper/clootrack/script.js')
  }
}

test('getScraperCatalog includes Clootrack as a verified empty-board first-party careers sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clootrack')
  const clootrack = await loadClootrackModule()

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Clootrack')
  assert.equal(provider.companyCareerPage, 'https://www.clootrack.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page-without-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'clootrack.com')
  assert.match(provider.modulePath, /clootrack[\\/]script\.js$/i)

  assert.equal(clootrack.PROVIDER_METADATA.source, provider.source)
  assert.equal(clootrack.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(clootrack.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Clootrack rows from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clootrack')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'clootrack')
  assert.match(scraper.dryRunFile, /clootrack[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Clootrack,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Clootrack', 'clootrack', 'Clootrack']],
  )
})
