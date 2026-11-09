import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/magicpin/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/magicpin/catalog.js')
  } catch {
    assert.fail('Expected Magicpin catalog module at ../../scraper/magicpin/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/magicpin/script.js')
  } catch {
    assert.fail('Expected Magicpin scraper module at ../../scraper/magicpin/script.js')
  }
}

test('Magicpin local catalog captures the verified exact-name empty careers page contract', async () => {
  const { MAGICPIN_CATALOG } = await loadCatalogModule()
  const magicpin = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MAGICPIN_CATALOG)

  assert.equal(provider.source, 'magicpin')
  assert.equal(provider.companyName, 'Magicpin')
  assert.equal(provider.officialBrandName, 'magicpin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://magicpin.in/')
  assert.equal(provider.companyCareerPage, 'https://magicpin.in/careers')
  assert.equal(provider.companyDomain, 'magicpin.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-empty-board-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-empty-open-roles-state-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /magicpin[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/magicpin\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Find your next job at magicpin/i)
  assert.match(provider.verifiedSurfaceSummary, /All open roles/i)
  assert.match(provider.verifiedSurfaceSummary, /No Jobs found/i)

  assert.equal(magicpin.PROVIDER_METADATA.source, MAGICPIN_CATALOG.source)
  assert.equal(magicpin.PROVIDER_METADATA.companyName, MAGICPIN_CATALOG.companyName)
  assert.equal(magicpin.PROVIDER_METADATA.companyCareerPage, MAGICPIN_CATALOG.companyCareerPage)
})

test('Magicpin exact backlog name matches directly from local provider metadata', async () => {
  const { MAGICPIN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Magicpin\n',
    catalog: [hydrateProviderCatalogEntry(MAGICPIN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Magicpin', 'magicpin', 'Magicpin']],
  )
})

test('Magicpin hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MAGICPIN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAGICPIN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Magicpin')
  assert.equal(provider.companyCareerPage, 'https://magicpin.in/careers')
  assert.equal(provider.companyDomain, 'magicpin.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.match(provider.modulePath, /magicpin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /magicpin[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
