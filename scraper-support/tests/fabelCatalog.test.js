import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fabel/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fabel/catalog.js')
  } catch {
    assert.fail('Expected Fabel catalog module at ../../scraper/fabel/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/fabel/script.js')
  } catch {
    assert.fail('Expected Fabel scraper module at ../../scraper/fabel/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Fabel local catalog captures the verified first-party no-public-jobs surface', async () => {
  const { FABEL_CATALOG } = await loadCatalogModule()
  const fabel = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FABEL_CATALOG)

  assert.equal(provider.source, 'fabel')
  assert.equal(provider.companyName, 'Fabel')
  assert.equal(provider.officialBrandName, 'Fabel Services Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.fabelservices.net/')
  assert.equal(provider.companyCareerPage, 'https://www.fabelservices.net/')
  assert.deepEqual(provider.checkedCareersRouteUrls, [
    'https://www.fabelservices.net/careers',
    'https://www.fabelservices.net/career',
    'https://www.fabelservices.net/jobs',
    'https://www.fabelservices.net/join-us',
    'https://www.fabelservices.net/openings',
  ])
  assert.equal(provider.companyDomain, 'fabelservices.net')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-common-careers-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabelservices\.net\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabelservices\.net\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Fabel Services Private Limited/i)
  assert.match(provider.verifiedSurfaceSummary, /Gurgaon 122016/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fabel[\\/]jobs\.json$/i)

  assert.equal(fabel.PROVIDER_METADATA.source, provider.source)
  assert.equal(fabel.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fabel.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.deepEqual(fabel.PROVIDER_METADATA.checkedCareersRouteUrls, provider.checkedCareersRouteUrls)
})

test('Fabel exact backlog row matches from the local provider contract without aliases', async () => {
  const { FABEL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fabel\n',
    catalog: [buildCatalogReadyProvider(FABEL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fabel', 'fabel', 'Fabel']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fabel'), false)
})
