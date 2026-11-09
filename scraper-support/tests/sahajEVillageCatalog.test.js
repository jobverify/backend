import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sahajevillage/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sahajevillage/catalog.js')
  } catch {
    assert.fail('Expected Sahaj e-Village catalog module at ../../scraper/sahajevillage/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sahajevillage/script.js')
  } catch {
    assert.fail('Expected Sahaj e-Village scraper module at ../../scraper/sahajevillage/script.js')
  }
}

test('Sahaj e-Village local catalog captures the verified exact-name legacy no-public-jobs contract', async () => {
  const { SAHAJ_E_VILLAGE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sahajEVillage = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SAHAJ_E_VILLAGE_CATALOG)

  assert.equal(defaultCatalog, SAHAJ_E_VILLAGE_CATALOG)
  assert.equal(provider.source, 'sahajevillage')
  assert.equal(provider.companyName, 'Sahaj e-Village')
  assert.equal(provider.officialBrandName, 'Sahaj e-Village Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyInfoUrl, 'https://skilldevelopment.sahajcorporate.com/')
  assert.equal(
    provider.companyCareerPage,
    'https://cblearning.sahajcorporate.com/elportal/home/join_us.php',
  )
  assert.equal(
    provider.learningHomeUrl,
    'https://cblearning.sahajcorporate.com/elportal/home/index.php',
  )
  assert.equal(provider.companyDomain, 'sahajcorporate.com')
  assert.equal(provider.atsPlatform, 'legacy-first-party-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-company-info-plus-elearning-join-us-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-company-info-page+verified-elearning-join-us-page+no-public-company-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sahajevillage[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/skilldevelopment\.sahajcorporate\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cblearning\.sahajcorporate\.com\/elportal\/home\/join_us\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Why Join Sahaj eLearning Courses/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public company jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sahaj e-Village'), false)

  assert.equal(sahajEVillage.PROVIDER_METADATA.source, SAHAJ_E_VILLAGE_CATALOG.source)
  assert.equal(sahajEVillage.PROVIDER_METADATA.companyName, SAHAJ_E_VILLAGE_CATALOG.companyName)
  assert.equal(sahajEVillage.PROVIDER_METADATA.companyInfoUrl, SAHAJ_E_VILLAGE_CATALOG.companyInfoUrl)
})

test('Sahaj e-Village exact backlog row matches directly from local provider metadata', async () => {
  const { SAHAJ_E_VILLAGE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sahaj e-Village\n',
    catalog: [hydrateProviderCatalogEntry(SAHAJ_E_VILLAGE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sahaj e-Village', 'sahajevillage', 'Sahaj e-Village']],
  )
})

test('Sahaj e-Village hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SAHAJ_E_VILLAGE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAHAJ_E_VILLAGE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sahaj e-Village')
  assert.equal(
    provider.companyCareerPage,
    'https://cblearning.sahajcorporate.com/elportal/home/join_us.php',
  )
  assert.equal(provider.companyDomain, 'sahajcorporate.com')
  assert.equal(provider.atsPlatform, 'legacy-first-party-site-no-public-careers')
  assert.match(provider.modulePath, /sahajevillage[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sahajevillage[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
