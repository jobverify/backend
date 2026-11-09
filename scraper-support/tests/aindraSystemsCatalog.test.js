import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const scriptModulePath = path.resolve(currentDir, '../../scraper/aindrasystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aindrasystems/catalog.js')
  } catch {
    assert.fail('Expected Aindra Systems catalog module at ../../scraper/aindrasystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aindrasystems/script.js')
  } catch {
    assert.fail('Expected Aindra Systems scraper module at ../../scraper/aindrasystems/script.js')
  }
}

test('Aindra Systems local catalog captures the verified first-party host outage contract for the homepage careers surface', async () => {
  const { AINDRA_SYSTEMS_CATALOG } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(AINDRA_SYSTEMS_CATALOG.source, 'aindrasystems')
  assert.equal(AINDRA_SYSTEMS_CATALOG.companyName, 'Aindra Systems')
  assert.equal(AINDRA_SYSTEMS_CATALOG.adapter, 'script')
  assert.equal(AINDRA_SYSTEMS_CATALOG.companyCareerPage, 'https://www.aindra.in/')
  assert.equal(AINDRA_SYSTEMS_CATALOG.applicationEmail, 'contactus@aindra.in')
  assert.equal(AINDRA_SYSTEMS_CATALOG.applicationUrl, 'mailto:contactus@aindra.in')
  assert.equal(AINDRA_SYSTEMS_CATALOG.companyDomain, 'aindra.in')
  assert.equal(AINDRA_SYSTEMS_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(AINDRA_SYSTEMS_CATALOG.countryFilter, 'India')
  assert.equal(
    AINDRA_SYSTEMS_CATALOG.paginationStrategy,
    'single-homepage-careers-section-or-unavailable-first-party-host-fail-closed',
  )
  assert.equal(
    AINDRA_SYSTEMS_CATALOG.extractionStrategy,
    'verified-homepage-careers-section+inline-role-modals+first-party-host-unavailable-fail-closed',
  )
  assert.equal(AINDRA_SYSTEMS_CATALOG.parser, 'custom-script')
  assert.equal(AINDRA_SYSTEMS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AINDRA_SYSTEMS_CATALOG.verifiedOn, '2026-07-28')
  assert.match(AINDRA_SYSTEMS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.aindra\.in\//i)
  assert.match(AINDRA_SYSTEMS_CATALOG.verifiedSurfaceSummary, /https:\/\/aindra\.in\//i)
  assert.match(AINDRA_SYSTEMS_CATALOG.verifiedSurfaceSummary, /no longer resolves in dns/i)
  assert.match(AINDRA_SYSTEMS_CATALOG.verifiedSurfaceSummary, /fails tls verification/i)
  assert.match(AINDRA_SYSTEMS_CATALOG.verifiedSurfaceSummary, /stays fail-closed/i)
  assert.equal(AINDRA_SYSTEMS_CATALOG.modulePath, scriptModulePath)

  assert.equal(scriptModule.PROVIDER_METADATA.source, AINDRA_SYSTEMS_CATALOG.source)
  assert.equal(
    scriptModule.PROVIDER_METADATA.companyCareerPage,
    AINDRA_SYSTEMS_CATALOG.companyCareerPage,
  )
  assert.equal(
    scriptModule.PROVIDER_METADATA.applicationEmail,
    AINDRA_SYSTEMS_CATALOG.applicationEmail,
  )
  assert.equal(
    scriptModule.PROVIDER_METADATA.applicationUrl,
    AINDRA_SYSTEMS_CATALOG.applicationUrl,
  )
})

test('buildScrapers and company coverage resolve Aindra Systems from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aindrasystems')
  const scraper = buildScrapers().find((item) => item.name === 'aindrasystems')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aindra Systems')
  assert.equal(provider.companyCareerPage, 'https://www.aindra.in/')
  assert.equal(provider.paginationStrategy, 'single-homepage-careers-section-or-unavailable-first-party-host-fail-closed')
  assert.equal(provider.extractionStrategy, 'verified-homepage-careers-section+inline-role-modals+first-party-host-unavailable-fail-closed')
  assert.equal(provider.verifiedOn, '2026-07-28')
  assert.match(provider.verifiedSurfaceSummary, /fails tls verification/i)
  assert.match(scraper.dryRunFile, /aindrasystems[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aindra Systems\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aindra Systems', 'aindrasystems', 'Aindra Systems']],
  )
})
