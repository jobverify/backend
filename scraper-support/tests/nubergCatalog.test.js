import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nubergModulePath = path.resolve(currentDir, '../../scraper/nuberg/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nuberg/catalog.js')
  } catch {
    assert.fail('Expected Nuberg catalog module at ../../scraper/nuberg/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nuberg/script.js')
  } catch {
    assert.fail('Expected Nuberg scraper module at ../../scraper/nuberg/script.js')
  }
}

test('Nuberg local catalog captures the verified first-party current-opportunities page without alias churn', async () => {
  const { NUBERG_CATALOG } = await loadCatalogModule()
  const nuberg = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NUBERG_CATALOG)

  assert.equal(provider.source, 'nuberg')
  assert.equal(provider.companyName, 'Nuberg')
  assert.equal(provider.officialBrandName, 'Nuberg EPC')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nubergepc.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nubergepc.com/career.html')
  assert.equal(provider.officialApplicationFormAnchor, '#career-form-section')
  assert.equal(provider.officialResumeSubmissionEmail, 'recruit@nuberg.in')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-html-opportunities-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-current-opportunities-blocks+mailto-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nubergepc.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /nuberg[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, nubergModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nubergepc\.com\/career\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /Process Lead \/ Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /recruit@nuberg\.in/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nuberg'), false)

  assert.equal(nuberg.PROVIDER_METADATA.source, NUBERG_CATALOG.source)
  assert.equal(nuberg.PROVIDER_METADATA.companyName, NUBERG_CATALOG.companyName)
  assert.equal(
    nuberg.PROVIDER_METADATA.officialResumeSubmissionEmail,
    NUBERG_CATALOG.officialResumeSubmissionEmail,
  )
})

test('Nuberg backlog row matches directly from the local catalog without alias churn', async () => {
  const { NUBERG_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nuberg\n',
    catalog: [hydrateProviderCatalogEntry(NUBERG_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nuberg', 'nuberg', 'Nuberg']],
  )
})

test('getScraperCatalog exposes Nuberg as a runnable shared provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nuberg')
  const scraper = buildScrapers().find((item) => item.name === 'nuberg')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Nuberg')
  assert.equal(provider.companyCareerPage, 'https://www.nubergepc.com/career.html')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nuberg'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Nuberg\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nuberg', 'nuberg', 'Nuberg']],
  )
})
