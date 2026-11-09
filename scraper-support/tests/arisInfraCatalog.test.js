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
const arisInfraModulePath = path.resolve(currentDir, '../../scraper/arisinfra/script.js')

const loadArisInfraCatalog = async () => {
  try {
    return await import('../../scraper/arisinfra/catalog.js')
  } catch {
    assert.fail('Expected ArisInfra catalog module at ../../scraper/arisinfra/catalog.js')
  }
}

const loadArisInfraModule = async () => {
  try {
    return await import('../../scraper/arisinfra/script.js')
  } catch {
    assert.fail('Expected ArisInfra scraper module at ../../scraper/arisinfra/script.js')
  }
}

test('ArisInfra local catalog captures the verified first-party careers page and embedded Keka surface', async () => {
  const { ARISINFRA_CATALOG } = await loadArisInfraCatalog()
  const arisInfra = await loadArisInfraModule()

  assert.equal(ARISINFRA_CATALOG.source, 'arisinfra')
  assert.equal(ARISINFRA_CATALOG.companyName, 'ArisInfra')
  assert.equal(ARISINFRA_CATALOG.officialBrandName, 'Arisinfra Solutions Limited')
  assert.equal(ARISINFRA_CATALOG.adapter, 'script')
  assert.equal(ARISINFRA_CATALOG.homepageUrl, 'https://aris.in/')
  assert.equal(ARISINFRA_CATALOG.companyCareerPage, 'https://aris.in/pages/careers')
  assert.equal(ARISINFRA_CATALOG.sitemapUrl, 'https://arisinfra.com/sitemap.xml')
  assert.equal(
    ARISINFRA_CATALOG.careerPortalInfoUrl,
    'https://arisinfra.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(ARISINFRA_CATALOG.expectedKekaDomain, 'https://arisinfra.keka.com/careers/')
  assert.equal(ARISINFRA_CATALOG.expectedIdentifier, 'cb2bd48a-dacd-45a9-9b06-df3dc4065912')
  assert.equal(ARISINFRA_CATALOG.companyDomain, 'aris.in')
  assert.equal(ARISINFRA_CATALOG.atsPlatform, 'keka-embed-api')
  assert.equal(ARISINFRA_CATALOG.countryFilter, 'India')
  assert.equal(
    ARISINFRA_CATALOG.paginationStrategy,
    'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    ARISINFRA_CATALOG.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-window-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(ARISINFRA_CATALOG.parser, 'custom-script')
  assert.equal(ARISINFRA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ARISINFRA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ARISINFRA_CATALOG.dryRunFile, 'arisinfra/jobs.json')
  assert.match(ARISINFRA_CATALOG.verifiedSurfaceSummary, /https:\/\/aris\.in\//i)
  assert.match(ARISINFRA_CATALOG.verifiedSurfaceSummary, /https:\/\/aris\.in\/pages\/careers/i)
  assert.match(ARISINFRA_CATALOG.verifiedSurfaceSummary, /https:\/\/arisinfra\.com\/sitemap\.xml/i)
  assert.match(ARISINFRA_CATALOG.verifiedSurfaceSummary, /https:\/\/arisinfra\.keka\.com\/careers\/api\/embedjobs\/js\/cb2bd48a-dacd-45a9-9b06-df3dc4065912/i)
  assert.match(ARISINFRA_CATALOG.verifiedSurfaceSummary, /8 active public India vacancies/i)
  assert.equal(ARISINFRA_CATALOG.modulePath, arisInfraModulePath)

  assert.equal(arisInfra.PROVIDER_METADATA.source, ARISINFRA_CATALOG.source)
  assert.equal(arisInfra.PROVIDER_METADATA.companyName, ARISINFRA_CATALOG.companyName)
  assert.equal(arisInfra.PROVIDER_METADATA.expectedKekaDomain, ARISINFRA_CATALOG.expectedKekaDomain)
})

test('ArisInfra backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ARISINFRA_CATALOG } = await loadArisInfraCatalog()
  const provider = hydrateProviderCatalogEntry(ARISINFRA_CATALOG)

  assert.equal(provider.companyName, 'ArisInfra')
  assert.equal(provider.companyDomain, 'aris.in')
  assert.match(provider.modulePath, /arisinfra[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /arisinfra[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ArisInfra'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'ArisInfra\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ArisInfra', 'arisinfra', 'ArisInfra']],
  )
})

test('buildScrapers and company coverage resolve ArisInfra from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arisinfra')
  const scraper = buildScrapers().find((item) => item.name === 'arisinfra')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'ArisInfra')
  assert.equal(provider.companyCareerPage, 'https://aris.in/pages/careers')
  assert.match(scraper.dryRunFile, /arisinfra[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'ArisInfra\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ArisInfra', 'arisinfra', 'ArisInfra']],
  )
})
