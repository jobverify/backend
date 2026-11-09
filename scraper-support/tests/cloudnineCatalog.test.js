import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCloudnineModule = async () => {
  try {
    return await import('../../scraper/cloudnine/script.js')
  } catch {
    assert.fail('Expected Cloudnine scraper module at ../../scraper/cloudnine/script.js')
  }
}

test('getScraperCatalog includes Cloudnine as a verified resume-only careers sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cloudnine')
  const cloudnine = await loadCloudnineModule()

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cloudnine')
  assert.equal(provider.companyCareerPage, 'https://www.cloudninecare.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-single-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-plus-resume-only-careers-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cloudninecare.com')
  assert.match(provider.modulePath, /cloudnine[\\/]script\.js$/i)

  assert.equal(cloudnine.PROVIDER_METADATA.source, provider.source)
  assert.equal(cloudnine.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(cloudnine.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Cloudnine rows from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cloudnine')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cloudnine')
  assert.match(scraper.dryRunFile, /cloudnine[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Cloudnine,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cloudnine', 'cloudnine', 'Cloudnine']],
  )
})
