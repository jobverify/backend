import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/enmovil/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/enmovil/catalog.js')
  } catch {
    assert.fail('Expected Enmovil catalog module at ../../scraper/enmovil/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/enmovil/script.js')
  } catch {
    assert.fail('Expected Enmovil scraper module at ../../scraper/enmovil/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Enmovil local catalog captures the verified first-party empty careers surface', async () => {
  const { ENMOVIL_CATALOG } = await loadCatalogModule()
  const enmovil = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ENMOVIL_CATALOG)

  assert.equal(provider.source, 'enmovil')
  assert.equal(provider.companyName, 'Enmovil')
  assert.equal(provider.officialBrandName, 'Enmovil')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.enmovil.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.enmovil.ai/careers')
  assert.equal(provider.sitemapUrl, 'https://www.enmovil.ai/sitemap.xml')
  assert.equal(provider.checkedJobsRouteUrl, 'https://www.enmovil.ai/jobs')
  assert.equal(provider.companyDomain, 'enmovil.ai')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-explicit-empty-careers-plus-sitemap-and-jobs-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap-home-url+verified-explicit-empty-careers-page+verified-jobs-route-404-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.enmovil\.ai\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.enmovil\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.enmovil\.ai\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.enmovil\.ai\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no open roles right now/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /enmovil[\\/]jobs\.json$/i)

  assert.equal(enmovil.PROVIDER_METADATA.source, provider.source)
  assert.equal(enmovil.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(enmovil.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(enmovil.PROVIDER_METADATA.sitemapUrl, provider.sitemapUrl)
})

test('Enmovil exact backlog row matches from the local provider contract without aliases', async () => {
  const { ENMOVIL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Enmovil\n',
    catalog: [buildCatalogReadyProvider(ENMOVIL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Enmovil', 'enmovil', 'Enmovil']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Enmovil'), false)
})
