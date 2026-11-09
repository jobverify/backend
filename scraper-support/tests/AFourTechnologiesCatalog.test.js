import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/afourtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/afourtechnologies/catalog.js')
  } catch {
    assert.fail('Expected AFour Technologies catalog module at ../../scraper/afourtechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/afourtechnologies/script.js')
  } catch {
    assert.fail('Expected AFour Technologies scraper module at ../../scraper/afourtechnologies/script.js')
  }
}

test('AFour Technologies local catalog captures the verified first-party careers page', async () => {
  const { AFOUR_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const afour = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(AFOUR_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, AFOUR_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'afourtechnologies')
  assert.equal(provider.companyName, 'AFour Technologies')
  assert.equal(provider.officialBrandName, 'AFour Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://afourtech.com/')
  assert.equal(provider.companyCareerPage, 'https://afourtech.com/careers-3/')
  assert.equal(provider.companyDomain, 'afourtech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-elementor-job-columns')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+elementor-job-columns+first-party-role-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedPublicJobCount, 6)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/afourtech\.com\/careers-3\//i)
  assert.match(provider.verifiedSurfaceSummary, /Cobol Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\. Python Developer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /afourtechnologies[\\/]jobs\.json$/i)

  assert.equal(afour.PROVIDER_METADATA.source, provider.source)
  assert.equal(afour.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('AFour Technologies exact backlog row resolves from the local provider contract', async () => {
  const { AFOUR_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AFour Technologies\n',
    catalog: [hydrateProviderCatalogEntry(AFOUR_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AFour Technologies', 'afourtechnologies', 'AFour Technologies']],
  )
})
