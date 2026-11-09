import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techspian/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techspian/catalog.js')
  } catch {
    assert.fail('Expected Techspian catalog module at ../../scraper/techspian/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techspian/script.js')
  } catch {
    assert.fail('Expected Techspian scraper module at ../../scraper/techspian/script.js')
  }
}

test('Techspian local catalog captures the verified legacy careers redirect with no trustworthy public jobs surface', async () => {
  const { TECHSPIAN_CATALOG } = await loadCatalogModule()
  const techspian = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TECHSPIAN_CATALOG)

  assert.equal(TECHSPIAN_CATALOG.source, 'techspian')
  assert.equal(TECHSPIAN_CATALOG.companyName, 'Techspian')
  assert.equal(TECHSPIAN_CATALOG.officialBrandName, 'Techspian')
  assert.equal(TECHSPIAN_CATALOG.adapter, 'script')
  assert.equal(TECHSPIAN_CATALOG.modulePath, modulePath)
  assert.equal(TECHSPIAN_CATALOG.dryRunFile, 'techspian/jobs.json')
  assert.equal(TECHSPIAN_CATALOG.officialHomepageUrl, 'https://techspian.com/')
  assert.equal(TECHSPIAN_CATALOG.companyCareerPage, 'https://www.techspian.com/techspian-careers/')
  assert.equal(TECHSPIAN_CATALOG.redirectedCareersPageUrl, 'https://techspian.com/about')
  assert.equal(TECHSPIAN_CATALOG.officialContactUrl, 'https://techspian.com/contact')
  assert.equal(TECHSPIAN_CATALOG.officialContactEmail, 'marketing@techspian.com')
  assert.equal(TECHSPIAN_CATALOG.companyDomain, 'techspian.com')
  assert.equal(TECHSPIAN_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(TECHSPIAN_CATALOG.countryFilter, 'India')
  assert.equal(
    TECHSPIAN_CATALOG.paginationStrategy,
    'verified-legacy-careers-redirect-plus-contact-page',
  )
  assert.equal(
    TECHSPIAN_CATALOG.extractionStrategy,
    'verified-legacy-careers-redirect+about-page+contact-page-without-trustworthy-public-jobs-return-empty',
  )
  assert.equal(TECHSPIAN_CATALOG.parser, 'custom-script')
  assert.equal(TECHSPIAN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(TECHSPIAN_CATALOG.verifiedOn, '2026-08-05')
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.techspian\.com\/techspian-careers\//i)
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /https:\/\/techspian\.com\/about/i)
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /https:\/\/techspian\.com\/contact/i)
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /marketing@techspian\.com/i)
  assert.match(TECHSPIAN_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(provider.source, 'techspian')
  assert.equal(provider.companyName, 'Techspian')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.techspian.com/techspian-careers/')
  assert.equal(provider.companyDomain, 'techspian.com')
  assert.match(provider.modulePath, /techspian[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /techspian[\\/]jobs\.json$/i)

  assert.equal(techspian.PROVIDER_METADATA.source, provider.source)
  assert.equal(techspian.CAREERS_URL, provider.companyCareerPage)
})

test('Techspian exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { TECHSPIAN_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Techspian\n',
    catalog: [hydrateProviderCatalogEntry(TECHSPIAN_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Techspian', 'techspian', 'Techspian']],
  )
})
