import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/goodera/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/goodera/catalog.js')
  } catch {
    assert.fail('Expected Goodera catalog module at ../../scraper/goodera/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/goodera/script.js')
  } catch {
    assert.fail('Expected Goodera scraper module at ../../scraper/goodera/script.js')
  }
}

test('Goodera local catalog captures the verified first-party handoff and public Kula board without alias churn', async () => {
  const { GOODERA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const goodera = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(GOODERA_CATALOG)

  assert.equal(defaultCatalog, GOODERA_CATALOG)
  assert.equal(provider.source, 'goodera')
  assert.equal(provider.companyName, 'Goodera')
  assert.equal(provider.officialBrandName, 'Goodera')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.goodera.com/')
  assert.equal(provider.aboutUsUrl, 'https://www.goodera.com/about/about-us')
  assert.equal(provider.companyCareerPage, 'https://www.goodera.com/about/contact-us')
  assert.equal(provider.officialCareersPageUrl, 'https://www.goodera.com/about/contact-us')
  assert.equal(provider.officialKulaCompanyUrl, 'https://careers.kula.ai/goodera')
  assert.equal(provider.officialJobsBoardUrl, 'https://careers.kula.ai/goodera?jobs=true')
  assert.equal(provider.verifiedSampleJobUrl, 'https://careers.kula.ai/goodera/32968/')
  assert.equal(provider.companyDomain, 'goodera.com')
  assert.equal(provider.atsPlatform, 'kula')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-contact-page-plus-public-kula-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+verified-first-party-contact-page+kula-embedded-jobs-json+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /goodera[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.goodera\.com\/about\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.goodera\.com\/about\/contact-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.kula\.ai\/goodera\?jobs=true/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.kula\.ai\/goodera\/32968\//i)
  assert.match(provider.verifiedSurfaceSummary, /AI Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Skill-Based Volunteering Associate/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Goodera'), false)

  assert.equal(goodera.PROVIDER_METADATA.source, GOODERA_CATALOG.source)
  assert.equal(goodera.PROVIDER_METADATA.companyName, GOODERA_CATALOG.companyName)
})

test('Goodera exact backlog row matches directly from the local provider metadata', async () => {
  const { GOODERA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Goodera\n',
    catalog: [hydrateProviderCatalogEntry(GOODERA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Goodera', 'goodera', 'Goodera']],
  )
})

test('Goodera hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { GOODERA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GOODERA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Goodera')
  assert.equal(provider.companyCareerPage, 'https://www.goodera.com/about/contact-us')
  assert.equal(provider.companyDomain, 'goodera.com')
  assert.equal(provider.atsPlatform, 'kula')
  assert.match(provider.modulePath, /goodera[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /goodera[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
