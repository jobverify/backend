import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const patanjaliModulePath = path.resolve(currentDir, '../../scraper/patanjali/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/patanjali/catalog.js')
  } catch {
    assert.fail('Expected Patanjali catalog module at ../../scraper/patanjali/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/patanjali/script.js')
  } catch {
    assert.fail('Expected Patanjali scraper module at ../../scraper/patanjali/script.js')
  }
}

test('Patanjali local catalog captures the verified exact-name application-form-only surface without alias churn', async () => {
  const { PATANJALI_CATALOG } = await loadCatalogModule()
  const patanjali = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PATANJALI_CATALOG)

  assert.equal(provider.source, 'patanjali')
  assert.equal(provider.companyName, 'Patanjali')
  assert.equal(provider.officialBrandName, 'Patanjali Ayurved')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://patanjaliayurved.org/')
  assert.equal(provider.companyCareerPage, 'https://patanjaliayurved.org/career.html')
  assert.equal(provider.officialApplicationFormUrl, 'https://patanjaliayurved.org/career.php')
  assert.equal(provider.officialCareerContactPage, 'https://patanjaliayurved.org/contact.html')
  assert.equal(provider.officialCareerEmail, 'career@patanjaliayurved.org')
  assert.equal(provider.cautionNoticeUrl, 'https://patanjaliayurved.org/caution-notice.html')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-iframe-plus-contact-and-caution-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-application-form+career-email-without-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'patanjaliayurved.org')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /patanjali[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, patanjaliModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/patanjaliayurved\.org\/career\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/patanjaliayurved\.org\/career\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /career@patanjaliayurved\.org/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Patanjali'), false)

  assert.equal(patanjali.PROVIDER_METADATA.source, PATANJALI_CATALOG.source)
  assert.equal(patanjali.PROVIDER_METADATA.companyName, PATANJALI_CATALOG.companyName)
  assert.equal(
    patanjali.PROVIDER_METADATA.officialApplicationFormUrl,
    PATANJALI_CATALOG.officialApplicationFormUrl,
  )
})

test('Patanjali backlog row matches directly from the local catalog without alias churn', async () => {
  const { PATANJALI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Patanjali\n',
    catalog: [hydrateProviderCatalogEntry(PATANJALI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Patanjali', 'patanjali', 'Patanjali']],
  )
})

test('getScraperCatalog exposes Patanjali as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'patanjali')
  const scraper = buildScrapers().find((item) => item.name === 'patanjali')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Patanjali')
  assert.equal(provider.companyCareerPage, 'https://patanjaliayurved.org/career.html')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Patanjali'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Patanjali\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Patanjali', 'patanjali', 'Patanjali']],
  )
})
