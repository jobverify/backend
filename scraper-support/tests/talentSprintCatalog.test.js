import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/talentsprint/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected TalentSprint provider contract at ../../scraper/talentsprint/provider.json')
  }
}

test('TalentSprint provider contract captures its first-party Darwinbox surface', async () => {
  const provider = hydrateProviderCatalogEntry(await loadProviderContract())

  assert.equal(provider.source, 'talentsprint')
  assert.equal(provider.companyName, 'TalentSprint')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://talentsprint.com/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://talentsprint.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://talentsprint.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.publicAllJobsUrl, 'https://talentsprint.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedInventoryStatus, 'coverage-gap')
  assert.equal(provider.sourceExtractionImplemented, false)
  assert.equal(provider.sourceGuardHardened, true)
  assert.match(provider.verifiedSurfaceSummary, /talentsprint\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /talentsprint\.darwinbox\.in/i)
  assert.match(provider.modulePath, /talentsprint[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /talentsprint[\\/]jobs\.json$/i)
})

test('TalentSprint resolves from the shared catalog and company coverage', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'talentsprint')
  const scraper = buildScrapers().find((item) => item.name === 'talentsprint')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'TalentSprint')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.match(scraper.dryRunFile, /talentsprint[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({ csvText: 'TalentSprint\n', catalog: getScraperCatalog() })
  assert.equal(report.matchedCount, 1)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [['TalentSprint', 'talentsprint']])
})
