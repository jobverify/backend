import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAparTechnologiesCatalog = async () => {
  try {
    return await import('../../scraper/apartechnologies/catalog.js')
  } catch {
    assert.fail('Expected Apar Technologies catalog module at ../../scraper/apartechnologies/catalog.js')
  }
}

test('Apar Technologies catalog captures the runtime-only CV intake and unresolved vacancy metadata', async () => {
  const {
    APAR_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadAparTechnologiesCatalog()

  assert.equal(defaultCatalog, APAR_TECHNOLOGIES_CATALOG)
  assert.equal(APAR_TECHNOLOGIES_CATALOG.source, 'apartechnologies')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.companyName, 'Apar Technologies')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://www.apartechnologies.com/careers/')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.companyDomain, 'apartechnologies.com')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.officialHomepageUrl, 'https://www.apartechnologies.com/')
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.usOpeningsPageUrl,
    'https://www.apartechnologies.com/job-posting/',
  )
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.apacOpeningsPageUrl,
    'https://www.apartechnologies.com/apac-2/',
  )
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.pageSitemapUrl,
    'https://www.apartechnologies.com/wp-sitemap-posts-page-1.xml',
  )
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.officialContactEmail,
    'sales.apartech@apar.com',
  )
  assert.equal(APAR_TECHNOLOGIES_CATALOG.atsPlatform, "official-company-careers-cv-intake")
  assert.equal(APAR_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.paginationStrategy,
    "current-homepage-and-redesigned-resume-upload-form-with-unresolved-inventory",
  )
  assert.equal(
    APAR_TECHNOLOGIES_CATALOG.extractionStrategy,
    "current-corporate-careers-handoff+resume-form-hiring-signal+explicit-unknown-vacancy-inventory",
  )
  assert.equal(APAR_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(APAR_TECHNOLOGIES_CATALOG.verifiedOn, null)
  assert.match(APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apartechnologies\.com\//i)
  assert.match(APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apartechnologies\.com\/careers\//i)
  assert.match(APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apartechnologies\.com\/job-posting\//i)
  assert.match(APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apartechnologies\.com\/apac-2\//i)
  assert.match(
    APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary,
    /no trustworthy public jobs surface/i,
  )
  assert.match(
    APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary,
    /sales\.apartech@apar\.com/i,
  )
  assert.match(APAR_TECHNOLOGIES_CATALOG.modulePath, /apartechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Apar Technologies'), false)
})

test('Apar Technologies backlog matching works directly from the local catalog metadata', async () => {
  const { APAR_TECHNOLOGIES_CATALOG } = await loadAparTechnologiesCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Apar Technologies\n',
    catalog: [APAR_TECHNOLOGIES_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apar Technologies', 'apartechnologies', 'Apar Technologies']],
  )
})

test('buildScrapers and company coverage resolve Apar Technologies from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apartechnologies')
  const scraper = buildScrapers().find((item) => item.name === 'apartechnologies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Apar Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.apartechnologies.com/careers/')
  assert.match(scraper.dryRunFile, /apartechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apar Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apar Technologies', 'apartechnologies', 'Apar Technologies']],
  )
})
