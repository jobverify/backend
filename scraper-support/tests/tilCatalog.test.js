import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/til/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/til/catalog.js')
  } catch {
    assert.fail('Expected TIL catalog module at ../../scraper/til/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/til/script.js')
  } catch {
    assert.fail('Expected TIL scraper module at ../../scraper/til/script.js')
  }
}

test('TIL local catalog captures the verified resume-intake sentinel without alias churn', async () => {
  const { TIL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const til = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TIL_CATALOG)

  assert.equal(defaultCatalog, TIL_CATALOG)
  assert.equal(provider.source, 'til')
  assert.equal(provider.companyName, 'TIL')
  assert.equal(provider.officialBrandName, 'Tractors India Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tilindia.in/careers/vacancies')
  assert.equal(provider.officialCareersPageUrl, 'https://www.tilindia.in/careers/vacancies')
  assert.equal(provider.companyDomain, 'tilindia.in')
  assert.equal(provider.atsPlatform, 'official-company-site-resume-intake-no-public-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-submit-cv-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+resume-intake+no-public-role-cards+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /til[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /recruitment@tilindia\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /submit your CV here/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TIL'), false)

  assert.equal(til.PROVIDER_METADATA.source, TIL_CATALOG.source)
  assert.equal(til.PROVIDER_METADATA.companyName, TIL_CATALOG.companyName)
})

test('TIL exact backlog row matches directly from the local provider metadata', async () => {
  const { TIL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TIL\n',
    catalog: [hydrateProviderCatalogEntry(TIL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TIL', 'til', 'TIL']],
  )
})

test('TIL hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TIL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TIL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TIL')
  assert.equal(provider.companyCareerPage, 'https://www.tilindia.in/careers/vacancies')
  assert.equal(provider.companyDomain, 'tilindia.in')
  assert.equal(provider.atsPlatform, 'official-company-site-resume-intake-no-public-openings')
  assert.match(provider.modulePath, /til[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /til[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
