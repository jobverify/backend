import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smartdrivesystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smartdrivesystems/catalog.js')
  } catch {
    assert.fail('Expected Smart Drive Systems catalog module at ../../scraper/smartdrivesystems/catalog.js')
  }
}

test('Smart Drive Systems local catalog captures the verified first-party legacy careers shell and fail-closed sentinel state', async () => {
  const { SMART_DRIVE_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMART_DRIVE_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, SMART_DRIVE_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'smartdrivesystems')
  assert.equal(provider.companyName, 'Smart Drive Systems')
  assert.equal(provider.officialBrandName, 'SmartDrive Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.smartdrive.net/careers/')
  assert.equal(provider.companyDomain, 'smartdrive.net')
  assert.equal(provider.officialCareersPageUrl, 'https://www.smartdrive.net/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'legacy-careers-shell-without-public-job-links')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-shell+fail-closed-sentinel')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /smartdrivesystems[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /VIEW ALL OPEN POSITIONS/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Smart Drive Systems exact backlog row resolves from the local provider contract', async () => {
  const { SMART_DRIVE_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Smart Drive Systems\n',
    catalog: [hydrateProviderCatalogEntry(SMART_DRIVE_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Smart Drive Systems', 'smartdrivesystems', 'Smart Drive Systems']],
  )
})
