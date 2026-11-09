import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dropboxModulePath = path.resolve(currentDir, '../../scraper/dropbox/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dropbox/catalog.js')
  } catch {
    assert.fail('Expected Dropbox catalog module at ../../scraper/dropbox/catalog.js')
  }
}

test('Dropbox local catalog captures the verified first-party careers redirect and sitemap-backed jobs surface', async () => {
  const {
    DROPBOX_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(DROPBOX_CATALOG.source, 'dropbox')
  assert.equal(DROPBOX_CATALOG.companyName, 'Dropbox')
  assert.equal(DROPBOX_CATALOG.officialBrandName, 'Dropbox')
  assert.equal(DROPBOX_CATALOG.adapter, 'script')
  assert.equal(DROPBOX_CATALOG.modulePath, dropboxModulePath)
  assert.equal(DROPBOX_CATALOG.dryRunFile, 'dropbox/jobs.json')
  assert.equal(DROPBOX_CATALOG.companyCareerPage, 'https://www.dropbox.com/jobs')
  assert.equal(DROPBOX_CATALOG.companyDomain, 'dropbox.jobs')
  assert.equal(DROPBOX_CATALOG.officialHomepageUrl, 'https://www.dropbox.com/')
  assert.equal(DROPBOX_CATALOG.officialCareersHomeUrl, 'https://www.dropbox.jobs/en/')
  assert.equal(DROPBOX_CATALOG.officialJobsListingUrl, 'https://www.dropbox.jobs/en/jobs/')
  assert.equal(DROPBOX_CATALOG.robotsTxtUrl, 'https://www.dropbox.jobs/robots.txt')
  assert.equal(DROPBOX_CATALOG.sitemapUrl, 'https://www.dropbox.jobs/sitemap.xml')
  assert.equal(DROPBOX_CATALOG.verifiedListingJobCount, 39)
  assert.equal(
    DROPBOX_CATALOG.verifiedSampleJobUrl,
    'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
  )
  assert.equal(DROPBOX_CATALOG.atsPlatform, 'official-company-careers-sitemap')
  assert.equal(DROPBOX_CATALOG.countryFilter, 'Global')
  assert.equal(
    DROPBOX_CATALOG.paginationStrategy,
    'first-party-robots-plus-sitemap-job-detail-url-discovery',
  )
  assert.equal(
    DROPBOX_CATALOG.extractionStrategy,
    'verified-careers-redirect+verified-jobs-listing+robots-advertised-sitemap+english-job-detail-urls',
  )
  assert.equal(DROPBOX_CATALOG.parser, 'custom-script')
  assert.equal(DROPBOX_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DROPBOX_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(DROPBOX_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.com\/jobs/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.jobs\/en\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.jobs\/en\/jobs\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.jobs\/robots\.txt/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.jobs\/sitemap\.xml/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b39 matching jobs\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dropbox\.jobs\/en\/jobs\/8053628\/data-engineer\//i)
})

test('Dropbox local catalog hydrates into company coverage without needing an alias entry', async () => {
  const { DROPBOX_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DROPBOX_CATALOG)

  assert.equal(provider.companyName, 'Dropbox')
  assert.equal(provider.companyDomain, 'dropbox.jobs')
  assert.match(provider.modulePath, /dropbox[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dropbox[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dropbox\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dropbox', 'dropbox', 'Dropbox']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dropbox'), false)
})
