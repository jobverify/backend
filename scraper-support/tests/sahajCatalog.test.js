import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sahaj/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sahaj/catalog.js')
  } catch {
    assert.fail('Expected Sahaj catalog module at ../../scraper/sahaj/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sahaj/script.js')
  } catch {
    assert.fail('Expected Sahaj scraper module at ../../scraper/sahaj/script.js')
  }
}

test('Sahaj local catalog captures the verified exact-name no-public-jobs contract', async () => {
  const { SAHAJ_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sahaj = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SAHAJ_CATALOG)

  assert.equal(defaultCatalog, SAHAJ_CATALOG)
  assert.equal(provider.source, 'sahaj')
  assert.equal(provider.companyName, 'Sahaj')
  assert.equal(provider.officialBrandName, 'Sahaj Retail Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sahaj.co.in/')
  assert.equal(provider.aboutPageUrl, 'https://retail.sahaj.co.in/web/retail/about-us')
  assert.equal(provider.companyCareerPage, 'https://retail.sahaj.co.in/joinuspage')
  assert.equal(provider.jobRolePageUrl, 'https://retail.sahaj.co.in/web/retail/job-role-page')
  assert.equal(provider.companyDomain, 'sahaj.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-about-plus-join-us-plus-job-role-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-join-us-partner-registration+verified-job-role-external-job-seeker-service-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sahaj[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sahaj\.co\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/retail\.sahaj\.co\.in\/joinuspage/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/retail\.sahaj\.co\.in\/web\/retail\/job-role-page/i)
  assert.match(provider.verifiedSurfaceSummary, /Sahaj Mitr/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public company jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sahaj'), false)

  assert.equal(sahaj.PROVIDER_METADATA.source, SAHAJ_CATALOG.source)
  assert.equal(sahaj.PROVIDER_METADATA.companyName, SAHAJ_CATALOG.companyName)
  assert.equal(sahaj.PROVIDER_METADATA.jobRolePageUrl, SAHAJ_CATALOG.jobRolePageUrl)
})

test('Sahaj exact backlog row matches directly from local provider metadata', async () => {
  const { SAHAJ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sahaj\n',
    catalog: [hydrateProviderCatalogEntry(SAHAJ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sahaj', 'sahaj', 'Sahaj']],
  )
})

test('Sahaj hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SAHAJ_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAHAJ_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sahaj')
  assert.equal(provider.companyCareerPage, 'https://retail.sahaj.co.in/joinuspage')
  assert.equal(provider.companyDomain, 'sahaj.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /sahaj[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sahaj[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
