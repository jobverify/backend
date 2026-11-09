import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/kheyti/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kheyti/catalog.js')
  } catch {
    assert.fail('Expected Kheyti catalog module at ../../scraper/kheyti/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kheyti/script.js')
  } catch {
    assert.fail('Expected Kheyti scraper module at ../../scraper/kheyti/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Kheyti local catalog captures the verified first-party join page and public jobs table contract', async () => {
  const { KHEYTI_CATALOG, VERIFIED_SURFACE_SUMMARY } = await loadCatalogModule()
  const kheyti = await loadScriptModule()
  const provider = buildCatalogReadyProvider(KHEYTI_CATALOG)

  assert.equal(provider.source, 'kheyti')
  assert.equal(provider.companyName, 'Kheyti')
  assert.equal(provider.officialBrandName, 'Kheyti')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.kheyti.com/')
  assert.equal(provider.companyCareerPage, 'https://jobs.kheyti.com/careers')
  assert.equal(provider.officialJoinPageUrl, 'https://www.kheyti.com/join-us')
  assert.equal(provider.officialJobsPageUrl, 'https://jobs.kheyti.com/careers')
  assert.equal(
    provider.sampleJobDetailUrl,
    'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-zohorecruit-careers-table-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-join-page+verified-public-zohorecruit-careers-table+detail-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kheyti.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.kheyti\.com\/join-us/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.kheyti\.com\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Current Job Openings/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Green House- Product Manager/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /public India openings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /kheyti[\\/]jobs\.json$/i)

  assert.equal(kheyti.PROVIDER_METADATA.source, provider.source)
  assert.equal(kheyti.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(kheyti.JOIN_PAGE_URL, provider.officialJoinPageUrl)
  assert.equal(kheyti.JOBS_PAGE_URL, provider.officialJobsPageUrl)
})

test('Kheyti exact backlog row matches from the local provider contract without aliases', async () => {
  const { KHEYTI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Kheyti\n',
    catalog: [buildCatalogReadyProvider(KHEYTI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kheyti', 'kheyti', 'Kheyti']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kheyti'), false)
})
