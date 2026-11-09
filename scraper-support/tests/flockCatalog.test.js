import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/flock/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/flock/catalog.js')
  } catch {
    assert.fail('Expected Flock catalog module at ../../scraper/flock/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/flock/script.js')
  } catch {
    assert.fail('Expected Flock scraper module at ../../scraper/flock/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Flock local catalog captures the verified first-party no-public-jobs careers shell', async () => {
  const { FLOCK_CATALOG } = await loadCatalogModule()
  const flock = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FLOCK_CATALOG)

  assert.equal(provider.source, 'flock')
  assert.equal(provider.companyName, 'Flock')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.flock.com/')
  assert.equal(provider.homepageCareersLinkUrl, 'https://careers.flock.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.flock.com/')
  assert.equal(provider.companyDomain, 'flock.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-careers-shell-without-public-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-link+verified-careers-shell-with-search-controls-and-work-email+verified-no-public-role-cards-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.flock\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.flock\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /http:\/\/careers\.flock\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Search Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /work@flock\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /flock[\\/]jobs\.json$/i)

  assert.equal(flock.PROVIDER_METADATA.source, provider.source)
  assert.equal(flock.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(flock.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(flock.PROVIDER_METADATA.homepageCareersLinkUrl, provider.homepageCareersLinkUrl)
})

test('Flock exact backlog row matches from the local provider contract without aliases', async () => {
  const { FLOCK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Flock\n',
    catalog: [buildCatalogReadyProvider(FLOCK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Flock', 'flock', 'Flock']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Flock'), false)
})
