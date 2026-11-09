import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nucleusModulePath = path.resolve(currentDir, '../../scraper/nucleussoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nucleussoftware/catalog.js')
  } catch {
    assert.fail('Expected Nucleus Software catalog module at ../../scraper/nucleussoftware/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nucleussoftware/script.js')
  } catch {
    assert.fail('Expected Nucleus Software scraper module at ../../scraper/nucleussoftware/script.js')
  }
}

test('Nucleus Software local catalog captures the verified first-party careers page and public Zoho jobs feed', async () => {
  const { NUCLEUS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const nucleusSoftware = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NUCLEUS_SOFTWARE_CATALOG)

  assert.equal(provider.source, 'nucleussoftware')
  assert.equal(provider.companyName, 'Nucleus Software')
  assert.equal(provider.officialBrandName, 'Nucleus Software Exports Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nucleussoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nucleussoftware.com/careers/')
  assert.equal(provider.careersPortalUrl, 'https://nucleussoftware.zohorecruit.in/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://nucleussoftware.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+zoho-public-job-openings-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nucleussoftware.com')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.dryRunFile, /nucleussoftware[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, nucleusModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nucleussoftware\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nucleussoftware\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /29 India jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Account Management - Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Lead - Power BI/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nucleus Software'), false)

  assert.equal(
    nucleusSoftware.PROVIDER_METADATA.source,
    NUCLEUS_SOFTWARE_CATALOG.source,
  )
  assert.equal(
    nucleusSoftware.PROVIDER_METADATA.companyName,
    NUCLEUS_SOFTWARE_CATALOG.companyName,
  )
  assert.equal(
    nucleusSoftware.PROVIDER_METADATA.careersApiUrl,
    NUCLEUS_SOFTWARE_CATALOG.careersApiUrl,
  )
})

test('Nucleus Software backlog row matches directly from the local catalog without alias churn', async () => {
  const { NUCLEUS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nucleus Software\n',
    catalog: [hydrateProviderCatalogEntry(NUCLEUS_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nucleus Software', 'nucleussoftware', 'Nucleus Software']],
  )
})

test('getScraperCatalog exposes Nucleus Software as a runnable shared provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nucleussoftware')
  const scraper = buildScrapers().find((item) => item.name === 'nucleussoftware')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Nucleus Software')
  assert.equal(provider.companyCareerPage, 'https://www.nucleussoftware.com/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nucleus Software'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Nucleus Software\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nucleus Software', 'nucleussoftware', 'Nucleus Software']],
  )
})
