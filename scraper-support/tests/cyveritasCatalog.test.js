import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  generateCompanyCoverageReport,
} from '../providers/companyCoverage.js'
import {
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cyveritas/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cyveritas/catalog.js')
  } catch {
    assert.fail('Expected Cyveritas catalog module at ../../scraper/cyveritas/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/cyveritas/script.js')
  } catch {
    assert.fail('Expected Cyveritas scraper module at ../../scraper/cyveritas/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Cyveritas local catalog captures the verified unresolved first-party surface', async () => {
  const { CYVERITAS_CATALOG } = await loadCatalogModule()
  const cyveritas = await loadScraperModule()
  const provider = buildCatalogReadyProvider(CYVERITAS_CATALOG)

  assert.equal(provider.source, 'cyveritas')
  assert.equal(provider.companyName, 'Cyveritas Risk Advisory Pvt. Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://cyveritas.com/careers')
  assert.equal(provider.companyDomain, 'cyveritas.com')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-canonical-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cyveritas\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cyveritas\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /DNS name does not exist/i)
  assert.match(provider.verifiedSurfaceSummary, /No newer first-party replacement domain/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cyveritas[\\/]jobs\.json$/i)

  assert.equal(cyveritas.PROVIDER_METADATA.source, provider.source)
  assert.equal(cyveritas.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(cyveritas.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Cyveritas exact backlog name matches from the local provider contract', async () => {
  const { CYVERITAS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cyveritas Risk Advisory Pvt. Ltd\n',
    catalog: [buildCatalogReadyProvider(CYVERITAS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cyveritas Risk Advisory Pvt. Ltd', 'cyveritas', 'Cyveritas Risk Advisory Pvt. Ltd']],
  )
})
