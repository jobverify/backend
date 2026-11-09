import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const edurekaModulePath = path.resolve(currentDir, '../../scraper/edureka/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/edureka/catalog.js')
  } catch {
    assert.fail('Expected Edureka catalog module at ../../scraper/edureka/catalog.js')
  }
}

const loadEdurekaModule = async () => {
  try {
    return await import('../../scraper/edureka/script.js')
  } catch {
    assert.fail('Expected Edureka scraper module at ../../scraper/edureka/script.js')
  }
}

test('Edureka local catalog captures the verified first-party careers page and inline opening links', async () => {
  const {
    EDUREKA_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const edureka = await loadEdurekaModule()
  const provider = hydrateProviderCatalogEntry(EDUREKA_CATALOG)

  assert.equal(provider.source, 'edureka')
  assert.equal(provider.companyName, 'Edureka')
  assert.equal(provider.officialBrandName, 'Edureka')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, edurekaModulePath)
  assert.equal(EDUREKA_CATALOG.dryRunFile, 'edureka/jobs.json')
  assert.match(provider.dryRunFile, /edureka[\\/]jobs\.json$/i)
  assert.equal(provider.rootUrl, 'https://www.edureka.co/')
  assert.equal(provider.companyCareerPage, 'https://www.edureka.co/careers')
  assert.equal(provider.brokenOpeningsRouteUrl, 'https://www.edureka.co/careers/job_details')
  assert.equal(provider.sampleJobUrl, 'https://www.edureka.co/openpositions/2/47')
  assert.equal(provider.applicationEmail, 'career@edureka.co')
  assert.equal(provider.companyDomain, 'edureka.co')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-inline-opening-links',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-opening-links+first-party-detail-pages+same-page-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.edureka\.co\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.edureka\.co\/careers\/job_details/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /career@edureka\.co/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.edureka\.co\/openpositions\/2\/47/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b5 visible openings\b/i)

  assert.equal(edureka.PROVIDER_METADATA.source, provider.source)
  assert.equal(edureka.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(edureka.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Edureka backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { EDUREKA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Edureka\n',
    catalog: [hydrateProviderCatalogEntry(EDUREKA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Edureka', 'edureka', 'Edureka']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Edureka'), false)
})
