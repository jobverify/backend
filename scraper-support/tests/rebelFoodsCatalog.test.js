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
const modulePath = path.resolve(currentDir, '../../scraper/rebelfoods/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rebelfoods/catalog.js')
  } catch {
    assert.fail('Expected Rebel Foods catalog module at ../../scraper/rebelfoods/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/rebelfoods/script.js')
  } catch {
    assert.fail('Expected Rebel Foods scraper module at ../../scraper/rebelfoods/script.js')
  }
}

test('Rebel Foods local catalog captures the verified official email-apply careers contract', async () => {
  const { REBEL_FOODS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rebelFoods = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(REBEL_FOODS_CATALOG)

  assert.equal(defaultCatalog, REBEL_FOODS_CATALOG)
  assert.equal(provider.source, 'rebelfoods')
  assert.equal(provider.companyName, 'Rebel Foods')
  assert.equal(provider.officialBrandName, 'Rebel Foods')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rebelfoods.com/')
  assert.equal(provider.companyCareerPage, 'https://www.rebelfoods.com/join-our-team')
  assert.equal(provider.officialCareersEmail, 'careers@rebelfoods.com')
  assert.equal(provider.companyDomain, 'rebelfoods.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation-only')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+email-apply-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /rebelfoods[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rebelfoods\.com\/join-our-team/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@rebelfoods\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rebel Foods'), false)

  assert.equal(rebelFoods.PROVIDER_METADATA.source, REBEL_FOODS_CATALOG.source)
  assert.equal(rebelFoods.PROVIDER_METADATA.companyName, REBEL_FOODS_CATALOG.companyName)
  assert.equal(
    rebelFoods.PROVIDER_METADATA.officialCareersEmail,
    REBEL_FOODS_CATALOG.officialCareersEmail,
  )
})

test('Rebel Foods exact backlog row resolves directly from local provider metadata', async () => {
  const { REBEL_FOODS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rebel Foods\n',
    catalog: [hydrateProviderCatalogEntry(REBEL_FOODS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rebel Foods', 'rebelfoods', 'Rebel Foods']],
  )
})

test('getScraperCatalog exposes Rebel Foods as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rebelfoods')
  const scraper = buildScrapers().find((item) => item.name === 'rebelfoods')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Rebel Foods')
  assert.equal(provider.companyCareerPage, 'https://www.rebelfoods.com/join-our-team')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rebel Foods'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Rebel Foods\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rebel Foods', 'rebelfoods', 'Rebel Foods']],
  )
})

test('Rebel Foods hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { REBEL_FOODS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(REBEL_FOODS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rebel Foods')
  assert.equal(provider.companyCareerPage, 'https://www.rebelfoods.com/join-our-team')
  assert.equal(provider.companyDomain, 'rebelfoods.com')
  assert.match(provider.modulePath, /rebelfoods[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /rebelfoods[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
