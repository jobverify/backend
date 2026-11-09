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
const modulePath = path.resolve(currentDir, '../../scraper/oxyzo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oxyzo/catalog.js')
  } catch {
    assert.fail('Expected Oxyzo catalog module at ../../scraper/oxyzo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/oxyzo/script.js')
  } catch {
    assert.fail('Expected Oxyzo scraper module at ../../scraper/oxyzo/script.js')
  }
}

test('Oxyzo local catalog captures the verified first-party careers board and pagination state', async () => {
  const { OXYZO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const oxyzo = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(OXYZO_CATALOG)

  assert.equal(defaultCatalog, OXYZO_CATALOG)
  assert.equal(provider.source, 'oxyzo')
  assert.equal(provider.companyName, 'Oxyzo')
  assert.equal(provider.officialBrandName, 'Oxyzo Financial Services Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.oxyzocareers.in/')
  assert.equal(provider.companyCareerPage, 'https://www.oxyzocareers.in/categories')
  assert.equal(provider.officialCareersPageUrl, 'https://www.oxyzocareers.in/categories')
  assert.equal(provider.jobPagePrefix, 'https://www.oxyzocareers.in/jobs/')
  assert.equal(provider.paginationQueryParam, 'comp-lyh6vd88_page')
  assert.equal(provider.companyDomain, 'oxyzo.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'numbered-query-param-pages-until-empty',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-categories-pages+first-party-job-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /oxyzo[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.oxyzocareers\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.oxyzocareers\.in\/categories/i)
  assert.match(provider.verifiedSurfaceSummary, /pages 1 through 4/i)
  assert.match(provider.verifiedSurfaceSummary, /page 5/i)
  assert.match(provider.verifiedSurfaceSummary, /\b11\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Area Sales Manager - SME Lending/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Manager/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oxyzo'), false)

  assert.equal(oxyzo.PROVIDER_METADATA.source, OXYZO_CATALOG.source)
  assert.equal(oxyzo.PROVIDER_METADATA.companyName, OXYZO_CATALOG.companyName)
  assert.equal(oxyzo.PROVIDER_METADATA.jobPagePrefix, OXYZO_CATALOG.jobPagePrefix)
})

test('Oxyzo exact backlog row matches directly from local provider metadata', async () => {
  const { OXYZO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Oxyzo\n',
    catalog: [hydrateProviderCatalogEntry(OXYZO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oxyzo', 'oxyzo', 'Oxyzo']],
  )
})

test('getScraperCatalog exposes Oxyzo as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oxyzo')
  const scraper = buildScrapers().find((item) => item.name === 'oxyzo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Oxyzo')
  assert.equal(provider.companyCareerPage, 'https://www.oxyzocareers.in/categories')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oxyzo'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Oxyzo\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oxyzo', 'oxyzo', 'Oxyzo']],
  )
})

test('Oxyzo hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { OXYZO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OXYZO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Oxyzo')
  assert.equal(provider.companyCareerPage, 'https://www.oxyzocareers.in/categories')
  assert.equal(provider.companyDomain, 'oxyzo.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /oxyzo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /oxyzo[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
