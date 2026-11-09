import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/magnitudesoftware.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/magnitudesoftware.workday/catalog.js')
  } catch {
    assert.fail('Expected Magnitude Software catalog module at ../../scraper/magnitudesoftware.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/magnitudesoftware.workday/script.js')
  } catch {
    assert.fail('Expected Magnitude Software scraper module at ../../scraper/magnitudesoftware.workday/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Magnitude Software local catalog captures the verified redirect into insightsoftware careers with Workday-linked India jobs', async () => {
  const { MAGNITUDE_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const magnitude = await loadScriptModule()
  const provider = buildCatalogReadyProvider(MAGNITUDE_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, MAGNITUDE_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'magnitudesoftware')
  assert.equal(provider.companyName, 'Magnitude Software')
  assert.equal(provider.officialBrandName, 'Magnitude Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.magnitude.com/')
  assert.equal(provider.companyCareerPage, 'https://insightsoftware.com/careers/')
  assert.equal(provider.redirectCompanyUrl, 'https://insightsoftware.com/magnitude/')
  assert.equal(provider.parentCompanyName, 'insightsoftware')
  assert.equal(provider.workdayTenantHost, 'https://magnitudesoftware.wd1.myworkdayjobs.com/')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://magnitudesoftware.wd1.myworkdayjobs.com/External')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-redirect-plus-shared-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-magnitude-homepage-redirect+verified-first-party-careers-shell+verified-workday-shell+shared-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'magnitude.com')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.magnitude\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/insightsoftware\.com\/magnitude\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/insightsoftware\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/magnitudesoftware\.wd1\.myworkdayjobs\.com\/External/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /HR Business Partner/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /magnitudesoftware.workday[\\/]jobs\.json$/i)

  assert.equal(magnitude.PROVIDER_METADATA.source, provider.source)
  assert.equal(magnitude.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(magnitude.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Magnitude Software exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { MAGNITUDE_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Magnitude Software\n',
    catalog: [buildCatalogReadyProvider(MAGNITUDE_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Magnitude Software', 'magnitudesoftware', 'Magnitude Software']],
  )
})
