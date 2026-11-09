import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/moonfroglabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/moonfroglabs/catalog.js')
  } catch {
    assert.fail('Expected Moonfrog Labs catalog module at ../../scraper/moonfroglabs/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/moonfroglabs/script.js')
  } catch {
    assert.fail('Expected Moonfrog Labs scraper module at ../../scraper/moonfroglabs/script.js')
  }
}

test('Moonfrog Labs local catalog captures the verified first-party no-openings careers sentinel state', async () => {
  const { MOONFROG_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const moonfrogLabs = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MOONFROG_LABS_CATALOG)

  assert.equal(defaultCatalog, MOONFROG_LABS_CATALOG)
  assert.equal(provider.source, 'moonfroglabs')
  assert.equal(provider.companyName, 'Moonfrog Labs')
  assert.equal(provider.officialBrandName, 'Moonfrog Labs Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://moonfroglabs.com/')
  assert.equal(provider.companyCareerPage, 'https://moonfroglabs.com/careers/')
  assert.equal(
    provider.recruitmentPrivacyPolicyUrl,
    'https://moonfroglabs.com/recruitment-privacy-policy/',
  )
  assert.equal(provider.applicationEmail, 'hr@moonfroglabs.com')
  assert.equal(provider.applicationUrl, 'mailto:hr@moonfroglabs.com')
  assert.equal(provider.companyDomain, 'moonfroglabs.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-careers-no-openings-message-plus-common-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-no-openings-message+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.dryRunFile, /moonfroglabs[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moonfroglabs\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/moonfroglabs\.com\/recruitment-privacy-policy\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /hr@moonfroglabs\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /No Open Positions Currently/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moonfroglabs\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moonfroglabs\.com\/open-positions\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(moonfrogLabs.PROVIDER_METADATA.source, MOONFROG_LABS_CATALOG.source)
  assert.equal(moonfrogLabs.PROVIDER_METADATA.companyName, MOONFROG_LABS_CATALOG.companyName)
  assert.equal(
    moonfrogLabs.PROVIDER_METADATA.companyCareerPage,
    MOONFROG_LABS_CATALOG.companyCareerPage,
  )
})

test('Moonfrog Labs exact backlog name matches directly from local provider metadata', async () => {
  const { MOONFROG_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Moonfrog Labs\n',
    catalog: [hydrateProviderCatalogEntry(MOONFROG_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Moonfrog Labs', 'moonfroglabs', 'Moonfrog Labs']],
  )
})

test('Moonfrog Labs hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MOONFROG_LABS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MOONFROG_LABS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Moonfrog Labs')
  assert.equal(provider.companyCareerPage, 'https://moonfroglabs.com/careers/')
  assert.equal(provider.companyDomain, 'moonfroglabs.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /moonfroglabs[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /moonfroglabs[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
