import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/seclore/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/seclore/catalog.js')
  } catch {
    assert.fail('Expected Seclore catalog module at ../../scraper/seclore/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/seclore/script.js')
  } catch {
    assert.fail('Expected Seclore scraper module at ../../scraper/seclore/script.js')
  }
}

test('Seclore local catalog captures the verified first-party careers page and public Darwinbox detail-link contract', async () => {
  const { SECLORE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const seclore = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SECLORE_CATALOG)

  assert.equal(defaultCatalog, SECLORE_CATALOG)
  assert.equal(provider.source, 'seclore')
  assert.equal(provider.companyName, 'Seclore')
  assert.equal(provider.officialBrandName, 'Seclore')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.seclore.com/')
  assert.equal(provider.companyCareerPage, 'https://www.seclore.com/about/careers/')
  assert.equal(provider.companyDomain, 'seclore.com')
  assert.equal(
    provider.publicJobHost,
    'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers-darwinbox-detail-links')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-inline-opening-links')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-darwinbox-detail-links+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /seclore[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.seclore\.com\/about\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Sales Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Human Resource Business Partner/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior DevOps Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Seclore'), false)

  assert.equal(seclore.PROVIDER_METADATA.source, SECLORE_CATALOG.source)
  assert.equal(seclore.CAREERS_URL, SECLORE_CATALOG.companyCareerPage)
  assert.equal(seclore.PUBLIC_JOB_HOST, SECLORE_CATALOG.publicJobHost)
})

test('Seclore exact backlog row resolves directly from local provider metadata', async () => {
  const { SECLORE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Seclore\n',
    catalog: [hydrateProviderCatalogEntry(SECLORE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Seclore', 'seclore', 'Seclore']],
  )
})

test('getScraperCatalog exposes Seclore as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'seclore')
  const scraper = buildScrapers().find((item) => item.name === 'seclore')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Seclore')
  assert.equal(provider.companyCareerPage, 'https://www.seclore.com/about/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Seclore'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Seclore\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Seclore', 'seclore', 'Seclore']],
  )
})

test('Seclore hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { SECLORE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SECLORE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Seclore')
  assert.equal(provider.companyCareerPage, 'https://www.seclore.com/about/careers/')
  assert.equal(provider.companyDomain, 'seclore.com')
  assert.match(provider.modulePath, /seclore[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /seclore[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
