import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const naviModulePath = path.resolve(currentDir, '../../scraper/navi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/navi/catalog.js')
  } catch {
    assert.fail('Expected Navi catalog module at ../../scraper/navi/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/navi/script.js')
  } catch {
    assert.fail('Expected Navi scraper module at ../../scraper/navi/script.js')
  }
}

test('Navi local catalog captures the verified first-party TurboHire careers surface', async () => {
  const { NAVI_CATALOG } = await loadCatalogModule()
  const navi = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NAVI_CATALOG)

  assert.equal(provider.source, 'navi')
  assert.equal(provider.companyName, 'Navi')
  assert.equal(provider.officialBrandName, 'Navi Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://navi.com/')
  assert.equal(provider.companyCareerPage, 'https://navi.com/careers')
  assert.equal(provider.companyDomain, 'navi.com')
  assert.equal(
    provider.handoffBoardUrl,
    'https://navi.turbohire.co/dashboardv2?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6&type=0',
  )
  assert.equal(provider.turboHireOrgId, '3e818601-0baa-429c-b6f8-4b21903ae0e6')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://navi.turbohire.co/job/publicjobs/35YCNAG2eaMoNphqxvoqVsso2VVeb_4pXd1YYAnRyqkx_FjWUqeRn1k243NU%2FQrF',
  )
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-turbohire-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-turbohire-board+noauth-token+filteredjobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /navi[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, naviModulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/navi\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/navi\.turbohire\.co\/dashboardv2\?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6&type=0/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /35 India jobs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Navi'), false)

  assert.equal(navi.PROVIDER_METADATA.source, NAVI_CATALOG.source)
  assert.equal(navi.PROVIDER_METADATA.companyName, NAVI_CATALOG.companyName)
  assert.equal(navi.PROVIDER_METADATA.handoffBoardUrl, NAVI_CATALOG.handoffBoardUrl)
})

test('Navi backlog row matches directly from provider metadata without alias churn', async () => {
  const { NAVI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Navi\n',
    catalog: [hydrateProviderCatalogEntry(NAVI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Navi', 'navi', 'Navi']],
  )
})
