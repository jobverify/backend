import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dtdcModulePath = path.resolve(currentDir, '../../scraper/dtdc/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dtdc/catalog.js')
  } catch {
    assert.fail('Expected DTDC catalog module at ../../scraper/dtdc/catalog.js')
  }
}

test('DTDC local catalog captures the verified first-party resume-drop career page and no-public-jobs surface', async () => {
  const {
    DTDC_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(DTDC_CATALOG.source, 'dtdc')
  assert.equal(DTDC_CATALOG.companyName, 'DTDC')
  assert.equal(DTDC_CATALOG.officialBrandName, 'DTDC')
  assert.equal(DTDC_CATALOG.adapter, 'script')
  assert.equal(DTDC_CATALOG.modulePath, dtdcModulePath)
  assert.equal(DTDC_CATALOG.dryRunFile, 'dtdc/jobs.json')
  assert.equal(DTDC_CATALOG.rootUrl, 'https://www.dtdc.com/')
  assert.equal(DTDC_CATALOG.homepageUrl, 'https://www.dtdc.com/in/')
  assert.equal(DTDC_CATALOG.companyCareerPage, 'https://www.dtdc.com/career/')
  assert.equal(DTDC_CATALOG.companyDomain, 'dtdc.com')
  assert.equal(DTDC_CATALOG.robotsTxtUrl, 'https://www.dtdc.com/robots.txt')
  assert.equal(DTDC_CATALOG.sitemapIndexUrl, 'https://www.dtdc.com/sitemap_index.xml')
  assert.equal(DTDC_CATALOG.pageSitemapUrl, 'https://www.dtdc.com/page-sitemap.xml')
  assert.equal(DTDC_CATALOG.verifiedResumeDropEmail, 'careers@dtdc.com')
  assert.equal(DTDC_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(DTDC_CATALOG.countryFilter, 'India')
  assert.equal(
    DTDC_CATALOG.paginationStrategy,
    'verified-root-redirect-plus-career-page-plus-robots-sitemap-plus-missing-job-routes',
  )
  assert.equal(
    DTDC_CATALOG.extractionStrategy,
    'verified-root-redirect+verified-homepage-career-link+verified-resume-drop-career-page+verified-robots-sitemap-with-single-career-url+verified-missing-job-routes-return-empty',
  )
  assert.equal(DTDC_CATALOG.parser, 'custom-script')
  assert.equal(DTDC_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DTDC_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(DTDC_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dtdc\.com\/career\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dtdc\.com\/robots\.txt/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dtdc\.com\/sitemap_index\.xml/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dtdc\.com\/page-sitemap\.xml/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /careers@dtdc\.com/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /commented-out sample job cards/i)
})

test('DTDC local catalog hydrates into coverage without needing an alias entry', async () => {
  const { DTDC_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DTDC_CATALOG)

  assert.equal(provider.companyName, 'DTDC')
  assert.equal(provider.companyDomain, 'dtdc.com')
  assert.match(provider.modulePath, /dtdc[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dtdc[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'DTDC\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DTDC', 'dtdc', 'DTDC']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DTDC'), false)
})
