import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mresultservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mresultservices/catalog.js')
  } catch {
    assert.fail('Expected MResult Services catalog module at ../../scraper/mresultservices/catalog.js')
  }
}

test('MResult Services local catalog captures the verified first-party no-public-inventory careers contract', async () => {
  const { MRESULT_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MRESULT_SERVICES_CATALOG)

  assert.equal(defaultCatalog, MRESULT_SERVICES_CATALOG)
  assert.equal(provider.source, 'mresultservices')
  assert.equal(provider.companyName, 'MResult Services')
  assert.equal(provider.officialBrandName, 'MResult')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://mresult.com/')
  assert.equal(provider.companyCareerPage, 'https://mresult.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://mresult.com/careers/')
  assert.equal(provider.contactPageUrl, 'https://mresult.com/contact-us/')
  assert.equal(provider.companyDomain, 'mresult.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-no-public-jobs-inventory')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-plus-contact-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-contact-page+no-trustworthy-public-jobs-inventory-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /View Current Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs inventory/i)
})

test('MResult Services exact backlog row resolves from the local provider contract', async () => {
  const { MRESULT_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MResult Services\n',
    catalog: [hydrateProviderCatalogEntry(MRESULT_SERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MResult Services', 'mresultservices', 'MResult Services']],
  )
})

test('MResult Services hydrated local catalog stays script-runner compatible', async () => {
  const { MRESULT_SERVICES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MRESULT_SERVICES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.match(provider.modulePath, /mresultservices[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
