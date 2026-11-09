import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shadowfax/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shadowfax/catalog.js')
  } catch {
    assert.fail('Expected Shadowfax catalog module at ../../scraper/shadowfax/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shadowfax/script.js')
  } catch {
    assert.fail('Expected Shadowfax scraper module at ../../scraper/shadowfax/script.js')
  }
}

test('Shadowfax local catalog captures the verified first-party empty-board careers surface', async () => {
  const { SHADOWFAX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shadowfax = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHADOWFAX_CATALOG)

  assert.equal(defaultCatalog, SHADOWFAX_CATALOG)
  assert.equal(provider.source, 'shadowfax')
  assert.equal(provider.companyName, 'Shadowfax')
  assert.equal(provider.officialBrandName, 'Shadowfax')
  assert.equal(provider.legalEntityName, 'Shadowfax Technologies Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.shadowfax.in/')
  assert.equal(provider.companyCareerPage, 'https://www.shadowfax.in/careers')
  assert.equal(provider.companyDomain, 'shadowfax.in')
  assert.deepEqual(provider.checkedNoPublicJobsRouteUrls, [
    'https://www.shadowfax.in/career',
    'https://www.shadowfax.in/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-state')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-empty-state-plus-adjacent-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-empty-state+verified-missing-adjacent-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /shadowfax[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.shadowfax\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.shadowfax\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /No job openings available at the moment\./i)
  assert.match(provider.verifiedSurfaceSummary, /Shadowfax Technologies Limited/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shadowfax'), false)

  assert.equal(shadowfax.PROVIDER_METADATA.source, SHADOWFAX_CATALOG.source)
  assert.equal(shadowfax.PROVIDER_METADATA.companyName, SHADOWFAX_CATALOG.companyName)
  assert.equal(shadowfax.PROVIDER_METADATA.companyCareerPage, SHADOWFAX_CATALOG.companyCareerPage)
})

test('Shadowfax exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SHADOWFAX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shadowfax\n',
    catalog: [hydrateProviderCatalogEntry(SHADOWFAX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shadowfax', 'shadowfax', 'Shadowfax']],
  )
})
