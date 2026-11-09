import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dsqsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dsqsoftware/catalog.js')
  } catch {
    assert.fail('Expected DSQ Software catalog module at ../../scraper/dsqsoftware/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/dsqsoftware/script.js')
  } catch {
    assert.fail('Expected DSQ Software scraper module at ../../scraper/dsqsoftware/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('DSQ Software local catalog captures the verified unresolved first-party surface without aliases', async () => {
  const { DSQ_SOFTWARE_CATALOG } = await loadCatalogModule()
  const dsq = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DSQ_SOFTWARE_CATALOG)

  assert.equal(provider.source, 'dsqsoftware')
  assert.equal(provider.companyName, 'DSQ Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://dsqsoftware.com/')
  assert.equal(provider.companyDomain, 'dsqsoftware.com')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'dns-resolution-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-dsqsoftware-and-dsqworld-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dsqsoftware\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dsqsoftware\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dsqsoftware\.co\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dsqworld\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /DNS name does not exist/i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy public first-party jobs surface was reachable/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dsqsoftware[\\/]jobs\.json$/i)

  assert.equal(dsq.PROVIDER_METADATA.source, provider.source)
  assert.equal(dsq.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(dsq.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('DSQ Software exact backlog name matches from the local provider contract without aliases', async () => {
  const { DSQ_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DSQ Software\n',
    catalog: [buildCatalogReadyProvider(DSQ_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DSQ Software', 'dsqsoftware', 'DSQ Software']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DSQ Software'), false)
})
