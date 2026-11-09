import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const falabellaModulePath = path.resolve(currentDir, '../../scraper/falabella/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/falabella/catalog.js')
  } catch {
    assert.fail('Expected Falabella catalog module at ../../scraper/falabella/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/falabella/script.js')
  } catch {
    assert.fail('Expected Falabella scraper module at ../../scraper/falabella/script.js')
  }
}

test('Falabella local catalog captures the verified first-party redirect, careers shell, bundle, and public jobs API', async () => {
  const {
    FALABELLA_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const falabella = await loadScriptModule()

  assert.equal(FALABELLA_CATALOG.source, 'falabella')
  assert.equal(FALABELLA_CATALOG.companyName, 'Falabella')
  assert.equal(FALABELLA_CATALOG.officialBrandName, 'Grupo Falabella')
  assert.equal(FALABELLA_CATALOG.adapter, 'script')
  assert.equal(FALABELLA_CATALOG.modulePath, falabellaModulePath)
  assert.equal(FALABELLA_CATALOG.dryRunFile, 'falabella/jobs.json')
  assert.equal(FALABELLA_CATALOG.companyCareerPage, 'https://jobs.falabella.com/')
  assert.equal(FALABELLA_CATALOG.companyDomain, 'muevete.falabella.com')
  assert.equal(FALABELLA_CATALOG.officialHomepageUrl, 'https://www.falabella.com/')
  assert.equal(FALABELLA_CATALOG.officialCareersHomeUrl, 'https://muevete.falabella.com/')
  assert.equal(
    FALABELLA_CATALOG.verifiedBundleUrl,
    'https://muevete.falabella.com/assets/index-BEcRIvKY.js',
  )
  assert.equal(
    FALABELLA_CATALOG.publicJobsApiUrl,
    'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external',
  )
  assert.equal(
    FALABELLA_CATALOG.verifiedSampleDetailApiUrl,
    'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/external/611174',
  )
  assert.equal(
    FALABELLA_CATALOG.verifiedSampleApplyUrl,
    'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
  )
  assert.equal(
    FALABELLA_CATALOG.verifiedSampleOfferInfoUrl,
    'https://falabella.airavirtual.com/offer_info/B673kVNCinevRIVb5luq?fbrefresh=STPm1B6TRvQvIzI8&id=1678396020',
  )
  assert.equal(FALABELLA_CATALOG.verifiedListingJobCount, 1899)
  assert.equal(FALABELLA_CATALOG.atsPlatform, 'first-party-bff-job-api')
  assert.equal(FALABELLA_CATALOG.countryFilter, 'Global')
  assert.equal(
    FALABELLA_CATALOG.paginationStrategy,
    'single-public-external-offers-feed',
  )
  assert.equal(
    FALABELLA_CATALOG.extractionStrategy,
    'verified-careers-redirect+verified-careers-shell+verified-public-bundle-client+verified-external-offers-api+airavirtual-apply-handoff',
  )
  assert.equal(FALABELLA_CATALOG.parser, 'custom-script')
  assert.equal(FALABELLA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FALABELLA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FALABELLA_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.falabella\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/muevete\.falabella\.com\//i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/muevete\.falabella\.com\/assets\/index-BEcRIvKY\.js/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/ftc-hr-tama-atrc\.falabella\.tech\/bff-sgdt-job-offer\/api\/ofertalaboral\/type\/external/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/ftc-hr-tama-atrc\.falabella\.tech\/bff-sgdt-job-offer\/api\/ofertalaboral\/external\/611174/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/falabella\.airavirtual\.com\/postula\/9FY0xC6XCTMRM1qokXsN\?logged_action=apply&register=true/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b1899 public records\b/i)

  assert.equal(falabella.PROVIDER_METADATA.source, FALABELLA_CATALOG.source)
  assert.equal(falabella.PROVIDER_METADATA.companyName, FALABELLA_CATALOG.companyName)
  assert.equal(falabella.CAREERS_ENTRY_URL, FALABELLA_CATALOG.companyCareerPage)
  assert.equal(falabella.CAREERS_HOME_URL, FALABELLA_CATALOG.officialCareersHomeUrl)
  assert.equal(falabella.PUBLIC_JOBS_API_URL, FALABELLA_CATALOG.publicJobsApiUrl)
})

test('Falabella local catalog hydrates exact-company coverage without shared-registry edits', async () => {
  const { FALABELLA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FALABELLA_CATALOG)

  assert.equal(provider.companyName, 'Falabella')
  assert.equal(provider.companyDomain, 'muevete.falabella.com')
  assert.match(provider.modulePath, /falabella[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /falabella[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Falabella\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Falabella', 'falabella', 'Falabella']],
  )
})
