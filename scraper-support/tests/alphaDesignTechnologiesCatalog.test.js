import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAlphaDesignTechnologiesCatalog = async () => {
  try {
    return await import('../../scraper/alphadesigntechnologies/catalog.js')
  } catch {
    assert.fail('Expected Alpha Design Technologies catalog module at ../../scraper/alphadesigntechnologies/catalog.js')
  }
}

test('Alpha Design Technologies provider metadata captures the verified first-party resume-only careers surface without aliases', async () => {
  const { ALPHA_DESIGN_TECHNOLOGIES_CATALOG } = await loadAlphaDesignTechnologiesCatalog()
  const provider = hydrateProviderCatalogEntry(ALPHA_DESIGN_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'alphadesigntechnologies')
  assert.equal(provider.companyName, 'Alpha Design Technologies')
  assert.equal(provider.officialBrandName, 'Alpha Design Technologies Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.adtl.co.in/careers')
  assert.equal(provider.homepageUrl, 'https://www.adtl.co.in/')
  assert.equal(provider.applicationEmail, 'careers@adtl.co.in')
  assert.equal(provider.applicationUrl, 'mailto:careers@adtl.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-resume-only-careers-page-plus-common-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-resume-only-careers-page+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'adtl.co.in')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /alphadesigntechnologies[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.adtl\.co\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@adtl\.co\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.adtl\.co\.in\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Alpha Design Technologies'), false)
})

test('Alpha Design Technologies backlog row matches directly from provider metadata without alias churn', async () => {
  const { ALPHA_DESIGN_TECHNOLOGIES_CATALOG } = await loadAlphaDesignTechnologiesCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Alpha Design Technologies\n',
    catalog: [hydrateProviderCatalogEntry(ALPHA_DESIGN_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alpha Design Technologies', 'alphadesigntechnologies', 'Alpha Design Technologies']],
  )
})

test('buildScrapers and company coverage resolve Alpha Design Technologies from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphadesigntechnologies')
  const scraper = buildScrapers().find((item) => item.name === 'alphadesigntechnologies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Alpha Design Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.adtl.co.in/careers')
  assert.match(scraper.dryRunFile, /alphadesigntechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Alpha Design Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alpha Design Technologies', 'alphadesigntechnologies', 'Alpha Design Technologies']],
  )
})
