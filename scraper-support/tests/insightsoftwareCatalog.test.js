import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/insightsoftware.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/insightsoftware.workday/catalog.js')
  } catch {
    assert.fail('Expected insightsoftware catalog module at ../../scraper/insightsoftware.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/insightsoftware.workday/script.js')
  } catch {
    assert.fail('Expected insightsoftware scraper module at ../../scraper/insightsoftware.workday/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('insightsoftware local catalog captures the verified first-party careers page with India Workday-linked jobs', async () => {
  const { INSIGHTSOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const insightsoftware = await loadScriptModule()
  const provider = buildCatalogReadyProvider(INSIGHTSOFTWARE_CATALOG)

  assert.equal(defaultCatalog, INSIGHTSOFTWARE_CATALOG)
  assert.equal(provider.source, 'insightsoftware')
  assert.equal(provider.companyName, 'insightsoftware')
  assert.equal(provider.officialBrandName, 'insightsoftware')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://insightsoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://insightsoftware.com/careers/')
  assert.equal(provider.workdayTenantHost, 'https://magnitudesoftware.wd1.myworkdayjobs.com/')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://magnitudesoftware.wd1.myworkdayjobs.com/External')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-shell-plus-shared-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+verified-workday-shell+shared-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'insightsoftware.com')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/insightsoftware\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Current Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/magnitudesoftware\.wd1\.myworkdayjobs\.com\/External/i)
  assert.match(provider.verifiedSurfaceSummary, /HR Business Partner/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Software Engineer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /insightsoftware.workday[\\/]jobs\.json$/i)

  assert.equal(insightsoftware.PROVIDER_METADATA.source, provider.source)
  assert.equal(insightsoftware.PROVIDER_METADATA.companyName, provider.companyName)
})

test('insightsoftware exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { INSIGHTSOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'insightsoftware\n',
    catalog: [buildCatalogReadyProvider(INSIGHTSOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['insightsoftware', 'insightsoftware', 'insightsoftware']],
  )
})
