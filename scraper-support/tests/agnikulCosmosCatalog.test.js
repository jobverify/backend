import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agnikulCosmosModulePath = path.resolve(currentDir, '../../scraper/agnikulcosmos/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/agnikulcosmos/catalog.js')
  } catch {
    assert.fail('Expected Agnikul Cosmos catalog module at ../../scraper/agnikulcosmos/catalog.js')
  }
}

const loadAgnikulCosmosModule = async () => {
  try {
    return await import('../../scraper/agnikulcosmos/script.js')
  } catch {
    assert.fail('Expected Agnikul Cosmos scraper module at ../../scraper/agnikulcosmos/script.js')
  }
}

test('Agnikul Cosmos local catalog captures the verified first-party inline careers-card surface', async () => {
  const { AGNIKUL_COSMOS_CATALOG } = await loadCatalogModule()
  const agnikulCosmos = await loadAgnikulCosmosModule()

  assert.equal(AGNIKUL_COSMOS_CATALOG.source, 'agnikulcosmos')
  assert.equal(AGNIKUL_COSMOS_CATALOG.companyName, 'Agnikul Cosmos')
  assert.equal(AGNIKUL_COSMOS_CATALOG.officialBrandName, 'Agnikul Cosmos')
  assert.equal(AGNIKUL_COSMOS_CATALOG.adapter, 'script')
  assert.equal(AGNIKUL_COSMOS_CATALOG.companyCareerPage, 'https://www.agnikul.in/careers/')
  assert.equal(AGNIKUL_COSMOS_CATALOG.homepageUrl, 'https://www.agnikul.in/')
  assert.equal(AGNIKUL_COSMOS_CATALOG.applicationEmail, 'humancapital@agnikul.in')
  assert.equal(AGNIKUL_COSMOS_CATALOG.applicationUrl, 'mailto:humancapital@agnikul.in')
  assert.equal(AGNIKUL_COSMOS_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(AGNIKUL_COSMOS_CATALOG.countryFilter, 'India')
  assert.equal(AGNIKUL_COSMOS_CATALOG.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    AGNIKUL_COSMOS_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+inline-role-cards+shared-email-apply-handoff',
  )
  assert.equal(AGNIKUL_COSMOS_CATALOG.parser, 'custom-script')
  assert.equal(AGNIKUL_COSMOS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AGNIKUL_COSMOS_CATALOG.companyDomain, 'agnikul.in')
  assert.equal(AGNIKUL_COSMOS_CATALOG.verifiedOn, '2026-07-14')
  assert.match(AGNIKUL_COSMOS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.agnikul\.in\/careers\//i)
  assert.match(AGNIKUL_COSMOS_CATALOG.verifiedSurfaceSummary, /Power electronics Engineer/i)
  assert.match(AGNIKUL_COSMOS_CATALOG.verifiedSurfaceSummary, /ERPNext Developer/i)
  assert.match(AGNIKUL_COSMOS_CATALOG.verifiedSurfaceSummary, /humancapital@agnikul\.in/i)
  assert.equal(AGNIKUL_COSMOS_CATALOG.modulePath, agnikulCosmosModulePath)

  assert.equal(agnikulCosmos.PROVIDER_METADATA.source, AGNIKUL_COSMOS_CATALOG.source)
  assert.equal(agnikulCosmos.PROVIDER_METADATA.companyName, AGNIKUL_COSMOS_CATALOG.companyName)
  assert.equal(
    agnikulCosmos.PROVIDER_METADATA.companyCareerPage,
    AGNIKUL_COSMOS_CATALOG.companyCareerPage,
  )
  assert.equal(
    agnikulCosmos.PROVIDER_METADATA.applicationEmail,
    AGNIKUL_COSMOS_CATALOG.applicationEmail,
  )
  assert.equal(
    agnikulCosmos.PROVIDER_METADATA.applicationUrl,
    AGNIKUL_COSMOS_CATALOG.applicationUrl,
  )
})

test('buildScrapers and company coverage resolve Agnikul Cosmos from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agnikulcosmos')
  const scraper = buildScrapers().find((item) => item.name === 'agnikulcosmos')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Agnikul Cosmos')
  assert.equal(provider.companyCareerPage, 'https://www.agnikul.in/careers/')
  assert.match(scraper.dryRunFile, /agnikulcosmos[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Agnikul Cosmos\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Agnikul Cosmos', 'agnikulcosmos', 'Agnikul Cosmos']],
  )
})
