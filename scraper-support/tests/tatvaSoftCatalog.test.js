import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tatvasoft/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tatvasoft/catalog.js')
  } catch {
    assert.fail('Expected TatvaSoft catalog module at ../../scraper/tatvasoft/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tatvasoft/script.js')
  } catch {
    assert.fail('Expected TatvaSoft scraper module at ../../scraper/tatvasoft/script.js')
  }
}

test('TatvaSoft local catalog captures the verified first-party career page and role detail pages without alias churn', async () => {
  const { TATVASOFT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tatvasoft = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TATVASOFT_CATALOG)

  assert.equal(defaultCatalog, TATVASOFT_CATALOG)
  assert.equal(provider.source, 'tatvasoft')
  assert.equal(provider.companyName, 'TatvaSoft')
  assert.equal(provider.officialBrandName, 'TatvaSoft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tatvasoft.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tatvasoft.com/career')
  assert.equal(provider.applicationEmail, 'career@tatvasoft.com')
  assert.equal(provider.applicationUrl, 'mailto:career@tatvasoft.com')
  assert.deepEqual(provider.verifiedOpeningUrls, [
    'https://www.tatvasoft.com/career/business-development-executive',
    'https://www.tatvasoft.com/career/java-developer',
  ])
  assert.equal(provider.companyDomain, 'tatvasoft.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-role-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+first-party-role-detail-pages+mailto-application',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicOpeningCount, 2)
  assert.match(provider.dryRunFile, /tatvasoft[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tatvasoft\.com\/career/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.tatvasoft\.com\/career\/business-development-executive/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.tatvasoft\.com\/career\/java-developer/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /career@tatvasoft\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /\b2 visible openings\b/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TatvaSoft'), false)

  assert.equal(tatvasoft.PROVIDER_METADATA.source, TATVASOFT_CATALOG.source)
  assert.equal(tatvasoft.PROVIDER_METADATA.companyName, TATVASOFT_CATALOG.companyName)
  assert.equal(tatvasoft.PROVIDER_METADATA.applicationEmail, TATVASOFT_CATALOG.applicationEmail)
})

test('TatvaSoft exact backlog row matches directly from local provider metadata', async () => {
  const { TATVASOFT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TatvaSoft\n',
    catalog: [hydrateProviderCatalogEntry(TATVASOFT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TatvaSoft', 'tatvasoft', 'TatvaSoft']],
  )
})

test('TatvaSoft hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TATVASOFT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TATVASOFT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TatvaSoft')
  assert.equal(provider.companyCareerPage, 'https://www.tatvasoft.com/career')
  assert.equal(provider.companyDomain, 'tatvasoft.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /tatvasoft[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tatvasoft[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
