import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mediBuddyModulePath = path.resolve(currentDir, '../../scraper/medibuddy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/medibuddy/catalog.js')
  } catch {
    assert.fail('Expected MediBuddy catalog module at ../../scraper/medibuddy/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/medibuddy/script.js')
  } catch {
    assert.fail('Expected MediBuddy scraper module at ../../scraper/medibuddy/script.js')
  }
}

test('MediBuddy local catalog captures the verified first-party Indore and MediReViva hiring surfaces', async () => {
  const { MEDIBUDDY_CATALOG } = await loadCatalogModule()
  const mediBuddy = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MEDIBUDDY_CATALOG)

  assert.equal(provider.source, 'medibuddy')
  assert.equal(provider.companyName, 'MediBuddy')
  assert.equal(provider.officialBrandName, 'MediBuddy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.medibuddy.in/health-services/indore-job-openings')
  assert.equal(provider.companyDomain, 'medibuddy.in')
  assert.deepEqual(provider.firstPartyJobPages, [
    'https://www.medibuddy.in/health-services/indore-job-openings',
    'https://www.medibuddy.in/health-services/medireviva',
  ])
  assert.equal(provider.trakstarJobsHost, 'https://medibuddy.hire.trakstar.com')
  assert.equal(provider.medirevivaApplyUrl, 'https://form.typeform.com/to/lCYKMpLE?typeform-source=www.google.com')
  assert.equal(provider.atsPlatform, 'first-party-framer-jobs-pages+mixed-public-details')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-page-per-program')
  assert.equal(
    provider.extractionStrategy,
    'verified-framer-role-cards+trakstar-details+public-google-doc-role-descriptions',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /medibuddy[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, mediBuddyModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /indore-job-openings/i)
  assert.match(provider.verifiedSurfaceSummary, /medireviva/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate\/ Senior Associate - Operations/i)
  assert.match(provider.verifiedSurfaceSummary, /Financial Analyst - AR/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MediBuddy'), false)

  assert.equal(mediBuddy.PROVIDER_METADATA.source, MEDIBUDDY_CATALOG.source)
  assert.equal(mediBuddy.PROVIDER_METADATA.companyName, MEDIBUDDY_CATALOG.companyName)
  assert.equal(mediBuddy.PROVIDER_METADATA.firstPartyJobPages.length, 2)
})

test('MediBuddy backlog row matches directly from the local catalog without alias churn', async () => {
  const { MEDIBUDDY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MediBuddy\n',
    catalog: [hydrateProviderCatalogEntry(MEDIBUDDY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MediBuddy', 'medibuddy', 'MediBuddy']],
  )
})
