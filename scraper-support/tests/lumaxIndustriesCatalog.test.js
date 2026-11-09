import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const lumaxIndustriesModulePath = path.resolve(currentDir, '../../scraper/lumaxindustries/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lumaxindustries/catalog.js')
  } catch {
    assert.fail('Expected Lumax Industries catalog module at ../../scraper/lumaxindustries/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lumaxindustries/script.js')
  } catch {
    assert.fail('Expected Lumax Industries scraper module at ../../scraper/lumaxindustries/script.js')
  }
}

test('Lumax Industries local catalog captures the verified official no-live-public-jobs surface', async () => {
  const { LUMAX_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const lumaxIndustries = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LUMAX_INDUSTRIES_CATALOG)

  assert.equal(provider.source, 'lumaxindustries')
  assert.equal(provider.companyName, 'Lumax Industries')
  assert.equal(provider.officialBrandName, 'Lumax Industries Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.lumaxworld.in/current-openings.html')
  assert.equal(provider.jobsBoardUrl, 'https://www.lumaxworld.in/current-openings.html')
  assert.equal(provider.officialCompanyPageUrl, 'https://www.lumaxworld.in/lumaxindustries/index.html')
  assert.equal(provider.workWithUsUrl, 'https://www.lumaxworld.in/work-with-us.html')
  assert.equal(provider.companyDomain, 'lumaxworld.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-live-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-listed-company-page-plus-current-openings-page-plus-work-with-us-form',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-listed-company-page+verified-current-openings-page+verified-work-with-us-page+no-live-public-job-cards-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.dryRunFile, /lumaxindustries[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, lumaxIndustriesModulePath)
  assert.match(provider.verifiedSurfaceSummary, /August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.lumaxworld\.in\/lumaxindustries\/index\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.lumaxworld\.in\/current-openings\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.lumaxworld\.in\/work-with-us\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job listings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lumax Industries'), false)

  assert.equal(lumaxIndustries.PROVIDER_METADATA.source, LUMAX_INDUSTRIES_CATALOG.source)
  assert.equal(lumaxIndustries.PROVIDER_METADATA.companyName, LUMAX_INDUSTRIES_CATALOG.companyName)
  assert.equal(
    lumaxIndustries.PROVIDER_METADATA.officialCompanyPageUrl,
    LUMAX_INDUSTRIES_CATALOG.officialCompanyPageUrl,
  )
})

test('Lumax Industries backlog row matches directly from the local catalog without alias churn', async () => {
  const { LUMAX_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Lumax Industries\n',
    catalog: [hydrateProviderCatalogEntry(LUMAX_INDUSTRIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lumax Industries', 'lumaxindustries', 'Lumax Industries']],
  )
})
