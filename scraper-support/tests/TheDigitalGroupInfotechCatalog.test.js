import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/thedigitalgroupinfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/thedigitalgroupinfotech/catalog.js')
  } catch {
    assert.fail('Expected The Digital Group Infotech catalog module at ../../scraper/thedigitalgroupinfotech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/thedigitalgroupinfotech/script.js')
  } catch {
    assert.fail('Expected The Digital Group Infotech scraper module at ../../scraper/thedigitalgroupinfotech/script.js')
  }
}

test('The Digital Group Infotech local catalog captures the verified first-party careers table', async () => {
  const { THE_DIGITAL_GROUP_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tdg = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(THE_DIGITAL_GROUP_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, THE_DIGITAL_GROUP_INFOTECH_CATALOG)
  assert.equal(provider.source, 'thedigitalgroupinfotech')
  assert.equal(provider.companyName, 'The Digital Group Infotech')
  assert.equal(provider.officialBrandName, 'The Digital Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.thedigitalgroup.com/')
  assert.equal(provider.companyCareerPage, 'https://www.thedigitalgroup.com/careers?page=1')
  assert.equal(provider.companyDomain, 'thedigitalgroup.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'server-rendered-first-party-careers-table')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-table-with-detail-and-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 10)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.thedigitalgroup\.com\/careers\?page=1/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /React Developer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /thedigitalgroupinfotech[\\/]jobs\.json$/i)

  assert.equal(tdg.PROVIDER_METADATA.source, provider.source)
  assert.equal(tdg.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('The Digital Group Infotech exact backlog row resolves from the local provider contract', async () => {
  const { THE_DIGITAL_GROUP_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'The Digital Group Infotech\n',
    catalog: [hydrateProviderCatalogEntry(THE_DIGITAL_GROUP_INFOTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['The Digital Group Infotech', 'thedigitalgroupinfotech', 'The Digital Group Infotech']],
  )
})
