import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const emudhraModulePath = path.resolve(currentDir, '../../scraper/emudhra/script.js')

const loadEmudhraCatalog = async () => {
  try {
    return await import('../../scraper/emudhra/catalog.js')
  } catch {
    assert.fail('Expected eMudhra catalog module at ../../scraper/emudhra/catalog.js')
  }
}

const loadEmudhraModule = async () => {
  try {
    return await import('../../scraper/emudhra/script.js')
  } catch {
    assert.fail('Expected eMudhra scraper module at ../../scraper/emudhra/script.js')
  }
}

test('eMudhra local catalog captures the verified India careers pages and broken openings handoff', async () => {
  const { EMUDHRA_CATALOG } = await loadEmudhraCatalog()
  const emudhra = await loadEmudhraModule()

  assert.equal(EMUDHRA_CATALOG.source, 'emudhra')
  assert.equal(EMUDHRA_CATALOG.companyName, 'eMudhra')
  assert.equal(EMUDHRA_CATALOG.officialBrandName, 'eMudhra')
  assert.equal(EMUDHRA_CATALOG.adapter, 'script')
  assert.equal(EMUDHRA_CATALOG.homepageUrl, 'https://emudhra.com/en-in/')
  assert.equal(EMUDHRA_CATALOG.companyCareerPage, 'https://emudhra.com/en-in/careers')
  assert.equal(EMUDHRA_CATALOG.careerPageUrl, 'https://emudhra.com/en-in/careers')
  assert.equal(EMUDHRA_CATALOG.globalCareerPageUrl, 'https://emudhra.com/en/careers')
  assert.equal(EMUDHRA_CATALOG.publishedOpeningsUrl, 'https://emudhra.com/en/careers-open-positions')
  assert.deepEqual(EMUDHRA_CATALOG.checkedBrokenOpeningsUrls, [
    'https://emudhra.com/en/careers-open-positions',
    'https://emudhra.com/en-in/careers-open-positions',
  ])
  assert.equal(EMUDHRA_CATALOG.sitemapUrl, 'https://emudhra.com/sitemap.xml')
  assert.equal(EMUDHRA_CATALOG.companyDomain, 'emudhra.com')
  assert.equal(EMUDHRA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(EMUDHRA_CATALOG.countryFilter, 'India')
  assert.equal(
    EMUDHRA_CATALOG.paginationStrategy,
    'validated-first-party-careers-pages-plus-broken-openings-routes',
  )
  assert.equal(
    EMUDHRA_CATALOG.extractionStrategy,
    'verified-india-careers-page+verified-global-careers-page+verified-broken-openings-routes+verified-sitemap-careers-without-openings+return-empty',
  )
  assert.equal(EMUDHRA_CATALOG.parser, 'custom-script')
  assert.equal(EMUDHRA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EMUDHRA_CATALOG.verifiedOn, '2026-08-15')
  assert.equal(EMUDHRA_CATALOG.dryRunFile, 'emudhra/jobs.json')
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /https:\/\/emudhra\.com\/en-in\/careers/i)
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /https:\/\/emudhra\.com\/en\/careers/i)
  assert.match(
    EMUDHRA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/emudhra\.com\/en\/careers-open-positions/i,
  )
  assert.match(
    EMUDHRA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/emudhra\.com\/en-in\/careers-open-positions/i,
  )
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /https:\/\/emudhra\.com\/sitemap\.xml/i)
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /browser-backed HTTPS fallback/i)
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /certificate verification/i)
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /Page Not Found/i)
  assert.match(EMUDHRA_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(EMUDHRA_CATALOG.modulePath, emudhraModulePath)

  assert.equal(emudhra.PROVIDER_METADATA.source, EMUDHRA_CATALOG.source)
  assert.equal(emudhra.PROVIDER_METADATA.companyName, EMUDHRA_CATALOG.companyName)
  assert.equal(emudhra.PROVIDER_METADATA.careerPageUrl, EMUDHRA_CATALOG.careerPageUrl)
  assert.equal(emudhra.PROVIDER_METADATA.publishedOpeningsUrl, EMUDHRA_CATALOG.publishedOpeningsUrl)
})

test('eMudhra backlog row hydrates locally through the exact company name', async () => {
  const { EMUDHRA_CATALOG } = await loadEmudhraCatalog()
  const provider = hydrateProviderCatalogEntry(EMUDHRA_CATALOG)

  assert.equal(provider.companyName, 'eMudhra')
  assert.equal(provider.companyDomain, 'emudhra.com')
  assert.match(provider.modulePath, /emudhra[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /emudhra[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'eMudhra\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['eMudhra', 'emudhra', 'eMudhra']],
  )
})
