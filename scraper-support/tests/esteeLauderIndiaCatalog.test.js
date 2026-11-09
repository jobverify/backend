import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const esteeLauderIndiaModulePath = path.resolve(currentDir, '../../scraper/esteelauderindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/esteelauderindia/catalog.js')
  } catch {
    assert.fail('Expected Estee Lauder India catalog module at ../../scraper/esteelauderindia/catalog.js')
  }
}

const loadEsteeLauderIndiaModule = async () => {
  try {
    return await import('../../scraper/esteelauderindia/script.js')
  } catch {
    assert.fail('Expected Estee Lauder India scraper module at ../../scraper/esteelauderindia/script.js')
  }
}

test('Estee Lauder India local catalog captures the verified first-party no-public-jobs surface without aliases', async () => {
  const { ESTEE_LAUDER_INDIA_CATALOG } = await loadCatalogModule()
  const esteeLauderIndia = await loadEsteeLauderIndiaModule()
  const provider = hydrateProviderCatalogEntry(ESTEE_LAUDER_INDIA_CATALOG)

  assert.equal(provider.source, 'esteelauderindia')
  assert.equal(provider.companyName, 'Estee Lauder India')
  assert.equal(provider.officialBrandName, 'The Estee Lauder Companies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.elcompanies.com/en/careers')
  assert.equal(provider.brandJobsPage, 'https://www.elcompanies.com/en/careers/brand-jobs')
  assert.equal(provider.corporateJobsPage, 'https://www.elcompanies.com/en/careers/corporate-jobs')
  assert.equal(provider.retailJobsPage, 'https://www.elcompanies.com/en/careers/retail-jobs')
  assert.equal(provider.technologyJobsPage, 'https://www.elcompanies.com/en/careers/technology-jobs')
  assert.equal(provider.searchJobsPage, 'https://www.elcompanies.com/en/careers/search-jobs')
  assert.equal(provider.companyDomain, 'elcompanies.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-hub-plus-empty-first-party-category-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-hub+verified-empty-first-party-india-careers-pages-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.elcompanies\.com\/en\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.elcompanies\.com\/en\/careers\/brand-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.elcompanies\.com\/en\/careers\/corporate-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.elcompanies\.com\/en\/careers\/retail-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.elcompanies\.com\/en\/careers\/technology-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /No jobs available\./i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.esteelauder\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.modulePath, /esteelauderindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /esteelauderindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, esteeLauderIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Estee Lauder India'), false)

  assert.equal(esteeLauderIndia.PROVIDER_METADATA.source, ESTEE_LAUDER_INDIA_CATALOG.source)
  assert.equal(esteeLauderIndia.PROVIDER_METADATA.companyName, ESTEE_LAUDER_INDIA_CATALOG.companyName)
  assert.equal(esteeLauderIndia.PROVIDER_METADATA.companyCareerPage, ESTEE_LAUDER_INDIA_CATALOG.companyCareerPage)
})

test('Estee Lauder India backlog row matches directly from local provider metadata without alias churn', async () => {
  const { ESTEE_LAUDER_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Estee Lauder India\n',
    catalog: [hydrateProviderCatalogEntry(ESTEE_LAUDER_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Estee Lauder India', 'esteelauderindia', 'Estee Lauder India']],
  )
})
