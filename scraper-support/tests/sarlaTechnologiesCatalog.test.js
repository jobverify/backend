import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sarlatechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sarlatechnologies/catalog.js')
  } catch {
    assert.fail('Expected Sarla Technologies catalog module at ../../scraper/sarlatechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sarlatechnologies/script.js')
  } catch {
    assert.fail('Expected Sarla Technologies scraper module at ../../scraper/sarlatechnologies/script.js')
  }
}

test('Sarla Technologies local catalog captures the verified first-party current openings and India detail subset without alias churn', async () => {
  const { SARLA_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sarla = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SARLA_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SARLA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'sarlatechnologies')
  assert.equal(provider.companyName, 'Sarla Technologies')
  assert.equal(provider.officialBrandName, 'Sarla Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://sarlatech.com/')
  assert.equal(provider.companyCareerPage, 'https://sarlatech.com/career/current-openings/')
  assert.equal(provider.verifiedCareerLandingPageUrl, 'https://sarlatech.com/career/')
  assert.equal(provider.sampleIndiaJobUrl, 'https://sarlatech.com/job/sicam-engineer-substation-automation/')
  assert.equal(provider.sampleNonIndiaJobUrl, 'https://sarlatech.com/job/scms-engineer/')
  assert.equal(provider.companyDomain, 'sarlatech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-openings-list-plus-first-party-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-openings-page+verified-first-party-job-detail-pages+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sarlatechnologies[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sarlatech\.com\/career\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sarlatech\.com\/job\/sicam-engineer-substation-automation\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sarlatech\.com\/job\/scms-engineer\//i)
  assert.match(provider.verifiedSurfaceSummary, /\bfour India-based roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bUAE\b/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sarla Technologies'), false)

  assert.equal(sarla.PROVIDER_METADATA.source, SARLA_TECHNOLOGIES_CATALOG.source)
  assert.equal(sarla.PROVIDER_METADATA.companyName, SARLA_TECHNOLOGIES_CATALOG.companyName)
  assert.equal(sarla.PROVIDER_METADATA.sampleIndiaJobUrl, SARLA_TECHNOLOGIES_CATALOG.sampleIndiaJobUrl)
})

test('Sarla Technologies backlog row matches directly from the local catalog without alias churn', async () => {
  const { SARLA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sarla Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SARLA_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sarla Technologies', 'sarlatechnologies', 'Sarla Technologies']],
  )
})

test('Sarla Technologies hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SARLA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SARLA_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sarla Technologies')
  assert.equal(provider.companyCareerPage, 'https://sarlatech.com/career/current-openings/')
  assert.equal(provider.companyDomain, 'sarlatech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /sarlatechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sarlatechnologies[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
