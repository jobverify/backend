import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ePayLaterModulePath = path.resolve(currentDir, '../../scraper/epaylater/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/epaylater/catalog.js')
  } catch {
    assert.fail('Expected ePayLater catalog module at ../../scraper/epaylater/catalog.js')
  }
}

const loadEPayLaterModule = async () => {
  try {
    return await import('../../scraper/epaylater/script.js')
  } catch {
    assert.fail('Expected ePayLater scraper module at ../../scraper/epaylater/script.js')
  }
}

test('ePayLater local catalog captures the verified first-party careers page and public Keka jobs surface without aliases', async () => {
  const { EPAYLATER_CATALOG } = await loadCatalogModule()
  const ePayLater = await loadEPayLaterModule()
  const provider = hydrateProviderCatalogEntry(EPAYLATER_CATALOG)

  assert.equal(provider.source, 'epaylater')
  assert.equal(provider.companyName, 'ePayLater')
  assert.equal(provider.officialBrandName, 'ePayLater')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.epaylater.in/')
  assert.equal(provider.companyCareerPage, 'https://www.epaylater.in/careers.html')
  assert.equal(
    provider.careerPortalInfoUrl,
    'https://epaylater.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(provider.expectedKekaDomain, 'https://epaylater.keka.com/careers/')
  assert.equal(provider.expectedIdentifier, '62503ac7-49d5-4c4c-98da-fb6b738d32f4')
  assert.equal(provider.companyDomain, 'epaylater.in')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-first-party-careers-page+embedded-keka-iframe+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.dryRunFile, /epaylater[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.epaylater\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.epaylater\.in\/careers\.html/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/epaylater\.keka\.com\/careers\/api\/organization\/default\/careerportalinfo/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/epaylater\.keka\.com\/careers\/api\/embedjobs\/default\/active\/62503ac7-49d5-4c4c-98da-fb6b738d32f4/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /13 active public India vacancies/i)
  assert.equal(provider.modulePath, ePayLaterModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ePayLater'), false)

  assert.equal(ePayLater.PROVIDER_METADATA.source, EPAYLATER_CATALOG.source)
  assert.equal(ePayLater.PROVIDER_METADATA.companyName, EPAYLATER_CATALOG.companyName)
  assert.equal(ePayLater.PROVIDER_METADATA.companyCareerPage, EPAYLATER_CATALOG.companyCareerPage)
})

test('ePayLater backlog row matches directly from local provider metadata without alias churn', async () => {
  const { EPAYLATER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ePayLater\n',
    catalog: [hydrateProviderCatalogEntry(EPAYLATER_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ePayLater', 'epaylater', 'ePayLater']],
  )
})
