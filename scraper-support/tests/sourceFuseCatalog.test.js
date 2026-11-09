import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sourcefuse/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sourcefuse/catalog.js')
  } catch {
    assert.fail('Expected SourceFuse catalog module at ../../scraper/sourcefuse/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sourcefuse/script.js')
  } catch {
    assert.fail('Expected SourceFuse scraper module at ../../scraper/sourcefuse/script.js')
  }
}

test('SourceFuse local catalog captures the verified India openings page and inline application form surface', async () => {
  const { SOURCEFUSE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sourceFuse = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SOURCEFUSE_CATALOG)

  assert.equal(defaultCatalog, SOURCEFUSE_CATALOG)
  assert.equal(provider.source, 'sourcefuse')
  assert.equal(provider.companyName, 'SourceFuse')
  assert.equal(provider.officialBrandName, 'SourceFuse')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sourcefuse.com/careers/?location=India')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sourcefuse.com/careers/')
  assert.equal(provider.indiaOpeningsUrl, 'https://www.sourcefuse.com/careers/?location=India')
  assert.equal(provider.verifiedApplicationFormAction, '/careers/?location=India#wpcf7-f91356-o1')
  assert.equal(provider.companyDomain, 'sourcefuse.com')
  assert.equal(provider.atsPlatform, 'official-company-site-public-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-verified-india-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-openings-page+inline-job-panels+onsite-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sourcefuse[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sourcefuse\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sourcefuse\.com\/careers\/\?location=India/i)
  assert.match(provider.verifiedSurfaceSummary, /wpcf7-f91356-o1/i)
  assert.match(provider.verifiedSurfaceSummary, /no separate public jobs api was required/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SourceFuse'), false)

  assert.equal(sourceFuse.PROVIDER_METADATA.source, SOURCEFUSE_CATALOG.source)
  assert.equal(sourceFuse.PROVIDER_METADATA.companyName, SOURCEFUSE_CATALOG.companyName)
  assert.equal(
    sourceFuse.PROVIDER_METADATA.verifiedApplicationFormAction,
    SOURCEFUSE_CATALOG.verifiedApplicationFormAction,
  )
})

test('SourceFuse exact backlog row matches directly from local provider metadata', async () => {
  const { SOURCEFUSE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SourceFuse\n',
    catalog: [hydrateProviderCatalogEntry(SOURCEFUSE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SourceFuse', 'sourcefuse', 'SourceFuse']],
  )
})

test('SourceFuse hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SOURCEFUSE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SOURCEFUSE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SourceFuse')
  assert.equal(provider.companyCareerPage, 'https://www.sourcefuse.com/careers/?location=India')
  assert.equal(provider.companyDomain, 'sourcefuse.com')
  assert.equal(provider.atsPlatform, 'official-company-site-public-job-pages')
  assert.match(provider.modulePath, /sourcefuse[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sourcefuse[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
