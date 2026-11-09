import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/iginfotechindia.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/iginfotechindia.workday/catalog.js')
  } catch {
    assert.fail('Expected IG Infotech India catalog module at ../../scraper/iginfotechindia.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/iginfotechindia.workday/script.js')
  } catch {
    assert.fail('Expected IG Infotech India scraper module at ../../scraper/iginfotechindia.workday/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('IG Infotech India local catalog captures the verified IG Group careers page, Bengaluru entity page, and Workday jobs surface', async () => {
  const { IG_INFOTECH_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const ig = await loadScriptModule()
  const provider = buildCatalogReadyProvider(IG_INFOTECH_INDIA_CATALOG)

  assert.equal(defaultCatalog, IG_INFOTECH_INDIA_CATALOG)
  assert.equal(provider.source, 'iginfotechindia')
  assert.equal(provider.companyName, 'IG Infotech India')
  assert.equal(provider.officialBrandName, 'IG Infotech India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.iggroup.com/')
  assert.equal(provider.companyCareerPage, 'https://www.iggroup.com/about-us/careers')
  assert.equal(provider.companyContactPageUrl, 'https://www.iggroup.com/contact-page')
  assert.equal(provider.workdayListingUrl, 'https://ig.wd103.myworkdayjobs.com/EXT_IG')
  assert.equal(provider.workdayTenantHost, 'https://ig.wd103.myworkdayjobs.com/')
  assert.equal(provider.parentCompanyName, 'IG Group')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-ig-careers-handoff-plus-bengaluru-entity-page-and-shared-workday-runner')
  assert.equal(
    provider.extractionStrategy,
    'verified-ig-careers-page+verified-bengaluru-entity-page+verified-workday-shell+shared-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iggroup.com')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.iggroup\.com\/about-us\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.iggroup\.com\/contact-page/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ig\.wd103\.myworkdayjobs\.com\/EXT_IG/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Cyber Defence Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Content Producer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /iginfotechindia.workday[\\/]jobs\.json$/i)

  assert.equal(ig.PROVIDER_METADATA.source, provider.source)
  assert.equal(ig.PROVIDER_METADATA.companyName, provider.companyName)
})

test('IG Infotech India exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { IG_INFOTECH_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IG Infotech India\n',
    catalog: [buildCatalogReadyProvider(IG_INFOTECH_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IG Infotech India', 'iginfotechindia', 'IG Infotech India']],
  )
})
