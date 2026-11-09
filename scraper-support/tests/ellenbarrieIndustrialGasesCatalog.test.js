import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ellenbarrieindustrialgases/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ellenbarrieindustrialgases/catalog.js')
  } catch {
    assert.fail(
      'Expected Ellenbarrie Industrial Gases catalog module at ../../scraper/ellenbarrieindustrialgases/catalog.js',
    )
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/ellenbarrieindustrialgases/script.js')
  } catch {
    assert.fail(
      'Expected Ellenbarrie Industrial Gases scraper module at ../../scraper/ellenbarrieindustrialgases/script.js',
    )
  }
}

test('Ellenbarrie Industrial Gases local catalog captures the verified first-party career form and no-public-openings contract', async () => {
  const {
    ELLENBARRIE_INDUSTRIAL_GASES_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const ellenbarrie = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ELLENBARRIE_INDUSTRIAL_GASES_CATALOG)

  assert.equal(provider.source, 'ellenbarrieindustrialgases')
  assert.equal(provider.companyName, 'Ellenbarrie Industrial Gases')
  assert.equal(provider.officialBrandName, 'Ellenbarrie')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.dryRunFile, 'ellenbarrieindustrialgases/jobs.json')
  assert.match(provider.dryRunFile, /ellenbarrieindustrialgases[\\/]jobs\.json$/i)
  assert.equal(provider.homepageUrl, 'https://ellenbarrie.com/')
  assert.equal(provider.companyCareerPage, 'https://ellenbarrie.com/career/')
  assert.equal(provider.robotsTxtUrl, 'https://ellenbarrie.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://ellenbarrie.com/sitemap.xml')
  assert.equal(provider.applicationEmail, 'info@ellenbarrie.com')
  assert.equal(provider.companyDomain, 'ellenbarrie.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-generic-form-no-public-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-generic-career-form-plus-missing-common-job-routes-plus-robots-sitemap-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-career-link+verified-generic-career-page-form-without-public-openings+verified-robots-and-sitemap+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/ellenbarrie\.com\/career\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /info@ellenbarrie\.com/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /wp-sitemap\.xml/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /candidate_name/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no public job titles/i)

  assert.equal(
    ellenbarrie.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(ellenbarrie.PROVIDER_METADATA.source, provider.source)
})

test('Ellenbarrie Industrial Gases backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { ELLENBARRIE_INDUSTRIAL_GASES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ellenbarrie Industrial Gases\n',
    catalog: [hydrateProviderCatalogEntry(ELLENBARRIE_INDUSTRIAL_GASES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Ellenbarrie Industrial Gases',
      'ellenbarrieindustrialgases',
      'Ellenbarrie Industrial Gases',
    ]],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Ellenbarrie Industrial Gases'),
    false,
  )
})
