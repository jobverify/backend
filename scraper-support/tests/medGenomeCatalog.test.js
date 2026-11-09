import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const medGenomeModulePath = path.resolve(currentDir, '../../scraper/medgenome/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/medgenome/catalog.js')
  } catch {
    assert.fail('Expected MedGenome catalog module at ../../scraper/medgenome/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/medgenome/script.js')
  } catch {
    assert.fail('Expected MedGenome scraper module at ../../scraper/medgenome/script.js')
  }
}

test('MedGenome local catalog captures the verified first-party careers page, admin-ajax feed, and detail pages', async () => {
  const { MEDGENOME_CATALOG } = await loadCatalogModule()
  const medGenome = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MEDGENOME_CATALOG)

  assert.equal(provider.source, 'medgenome')
  assert.equal(provider.companyName, 'MedGenome')
  assert.equal(provider.officialBrandName, 'MedGenome')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://diagnostics.medgenome.com/career/')
  assert.equal(provider.companyDomain, 'diagnostics.medgenome.com')
  assert.equal(provider.jobsApiUrl, 'https://diagnostics.medgenome.com/wp-admin/admin-ajax.php')
  assert.equal(provider.ajaxAction, 'career_listing')
  assert.equal(provider.atsPlatform, 'first-party-wordpress-careers-ajax')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-admin-ajax-page-loop-until-empty-html')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page-shell+career_listing-admin-ajax-html+detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /medgenome[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, medGenomeModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/diagnostics\.medgenome\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /wp-admin\/admin-ajax\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Zonal Business Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Manager - Scientific Affairs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MedGenome'), false)

  assert.equal(medGenome.PROVIDER_METADATA.source, MEDGENOME_CATALOG.source)
  assert.equal(medGenome.PROVIDER_METADATA.companyName, MEDGENOME_CATALOG.companyName)
  assert.equal(medGenome.PROVIDER_METADATA.jobsApiUrl, MEDGENOME_CATALOG.jobsApiUrl)
})

test('MedGenome backlog row matches directly from the local catalog without alias churn', async () => {
  const { MEDGENOME_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MedGenome\n',
    catalog: [hydrateProviderCatalogEntry(MEDGENOME_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MedGenome', 'medgenome', 'MedGenome']],
  )
})
