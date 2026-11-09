import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amantra/catalog.js')
  } catch {
    assert.fail('Expected Amantra catalog module at ../../scraper/amantra/catalog.js')
  }
}

test('Amantra local catalog captures the verified first-party careers surface without alias churn', async () => {
  const { AMANTRA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMANTRA_CATALOG)

  assert.equal(provider.source, 'amantra')
  assert.equal(provider.companyName, 'Amantra')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.amantra.ai/careers')
  assert.equal(provider.homepageUrl, 'https://www.amantra.ai/')
  assert.equal(provider.sitemapUrl, 'https://www.amantra.ai/sitemap.xml')
  assert.equal(provider.companyDomain, 'amantra.ai')
  assert.equal(provider.applicationEmail, 'careers@amantra.ai')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-sitemap-role-discovery',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-sitemap-role-set+first-party-detail-pages+email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.deepEqual(provider.verifiedRoleUrls, [
    'https://www.amantra.ai/careers/technical-project-manager',
    'https://www.amantra.ai/careers/engineering-manager',
    'https://www.amantra.ai/careers/business-development-executive-(bde)',
    'https://www.amantra.ai/careers/qa-manual',
    'https://www.amantra.ai/careers/business-development-manager-(bdm)',
    'https://www.amantra.ai/careers/full-stack-developer',
    'https://www.amantra.ai/careers/nodejs-developer',
  ])
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /amantra[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.amantra\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.amantra\.ai\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@amantra\.ai/i)
  assert.match(provider.verifiedSurfaceSummary, /technical-project-manager/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amantra'), false)
})

test('Amantra backlog row matches directly from the local provider metadata without aliases', async () => {
  const { AMANTRA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Amantra\n',
    catalog: [hydrateProviderCatalogEntry(AMANTRA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amantra', 'amantra', 'Amantra']],
  )
})

test('buildScrapers and company coverage resolve Amantra from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amantra')
  const scraper = buildScrapers().find((item) => item.name === 'amantra')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amantra')
  assert.equal(provider.companyCareerPage, 'https://www.amantra.ai/careers')
  assert.match(scraper.dryRunFile, /amantra[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amantra\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amantra', 'amantra', 'Amantra']],
  )
})
