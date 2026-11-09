import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sattrix/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sattrix/catalog.js')
  } catch {
    assert.fail('Expected Sattrix catalog module at ../../scraper/sattrix/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sattrix/script.js')
  } catch {
    assert.fail('Expected Sattrix scraper module at ../../scraper/sattrix/script.js')
  }
}

test('Sattrix local catalog captures the verified same-domain public Current Openings board', async () => {
  const { SATTRIX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sattrix = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SATTRIX_CATALOG)

  assert.equal(defaultCatalog, SATTRIX_CATALOG)
  assert.equal(provider.source, 'sattrix')
  assert.equal(provider.companyName, 'Sattrix')
  assert.equal(provider.officialBrandName, 'Sattrix Information Security')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sattrix.com/career.php')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sattrix.com/career.php')
  assert.equal(provider.companyDomain, 'sattrix.com')
  assert.equal(
    provider.applicationFormUrl,
    'https://docs.google.com/forms/d/e/1FAIpQLSdzjRKoDdKMbn_U1b8TqztyHqpEdbV8X18fCdB5dAJ1tGcURg/viewform?usp=sf_link',
  )
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+text-section-roles+same-page-details+same-page-anchor-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /sattrix[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sattrix\.com\/career\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Cybersecurity Associate/i)
  assert.match(provider.verifiedSurfaceSummary, /Cybersecurity Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Splunk Admin/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sattrix'), false)

  assert.equal(sattrix.PROVIDER_METADATA.source, SATTRIX_CATALOG.source)
  assert.equal(sattrix.PROVIDER_METADATA.companyName, SATTRIX_CATALOG.companyName)
})

test('Sattrix exact backlog row matches directly from local provider metadata', async () => {
  const { SATTRIX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sattrix\n',
    catalog: [hydrateProviderCatalogEntry(SATTRIX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sattrix', 'sattrix', 'Sattrix']],
  )
})

test('Sattrix hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SATTRIX_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SATTRIX_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sattrix')
  assert.equal(provider.companyCareerPage, 'https://www.sattrix.com/career.php')
  assert.equal(provider.companyDomain, 'sattrix.com')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.match(provider.modulePath, /sattrix[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sattrix[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
