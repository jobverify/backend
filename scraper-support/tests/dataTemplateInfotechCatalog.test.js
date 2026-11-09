import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/datatemplateinfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/datatemplateinfotech/catalog.js')
  } catch {
    assert.fail('Expected Data Template Infotech catalog module at ../../scraper/datatemplateinfotech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/datatemplateinfotech/script.js')
  } catch {
    assert.fail('Expected Data Template Infotech scraper module at ../../scraper/datatemplateinfotech/script.js')
  }
}

test('Data Template Infotech local catalog captures the verified first-party careers page and fail-closed sentinel contract', async () => {
  const { DATA_TEMPLATE_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const dataTemplateInfotech = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(DATA_TEMPLATE_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, DATA_TEMPLATE_INFOTECH_CATALOG)
  assert.equal(provider.source, 'datatemplateinfotech')
  assert.equal(provider.companyName, 'Data Template Infotech')
  assert.equal(provider.officialBrandName, 'Data Template Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.datatemplate.com/')
  assert.equal(provider.companyCareerPage, 'https://www.datatemplate.com/en/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.datatemplate.com/en/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-job-records')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-without-public-job-records',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+returns-empty-array',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'datatemplate.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.datatemplate\.com\/en\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Current openings/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@datatemplate\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no public job records/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /datatemplateinfotech[\\/]jobs\.json$/i)

  assert.equal(dataTemplateInfotech.PROVIDER_METADATA.source, provider.source)
  assert.equal(dataTemplateInfotech.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    dataTemplateInfotech.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
})

test('Data Template Infotech coverage resolves the backlog company rows without an alias entry', async () => {
  const { DATA_TEMPLATE_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Data Template Infotech\nData Template Infotech Pvt Ltd\n',
    catalog: [hydrateProviderCatalogEntry(DATA_TEMPLATE_INFOTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Data Template Infotech', 'datatemplateinfotech', 'Data Template Infotech'],
      ['Data Template Infotech Pvt Ltd', 'datatemplateinfotech', 'Data Template Infotech'],
    ],
  )
})
