import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const schooglyModulePath = path.resolve(currentDir, '../../scraper/schoogly/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/schoogly/catalog.js')
  } catch {
    assert.fail('Expected Schoogly catalog module at ../../scraper/schoogly/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/schoogly/script.js')
  } catch {
    assert.fail('Expected Schoogly scraper module at ../../scraper/schoogly/script.js')
  }
}

test('Schoogly local catalog captures the fail-closed exact-name timeout sentinel metadata without alias churn', async () => {
  const { SCHOOGLY_CATALOG } = await loadCatalogModule()
  const schoogly = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SCHOOGLY_CATALOG)

  assert.equal(provider.source, 'schoogly')
  assert.equal(provider.companyName, 'Schoogly')
  assert.equal(provider.officialBrandName, 'Schoogly')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://schoogly.com/')
  assert.equal(provider.homepageUrl, 'https://schoogly.com/')
  assert.equal(provider.companyDomain, 'schoogly.com')
  assert.equal(provider.atsPlatform, 'exact-name-domain-timeout-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-first-party-route-timeout-validation')
  assert.equal(provider.extractionStrategy, 'candidate-exact-name-first-party-routes-timeout-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.deepEqual(provider.firstPartyTimeoutUrls, [
    'https://schoogly.com/',
    'https://www.schoogly.com/',
    'https://schoogly.com/careers',
    'https://www.schoogly.com/careers',
    'https://schoogly.com/jobs',
    'https://www.schoogly.com/jobs',
  ])
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/schoogly\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.schoogly\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Connection timed out/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.dryRunFile, /schoogly[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /schoogly[\\/]script\.js$/i)
  assert.equal(provider.modulePath, schooglyModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Schoogly'), false)

  assert.equal(schoogly.PROVIDER_METADATA.source, SCHOOGLY_CATALOG.source)
  assert.deepEqual(schoogly.FIRST_PARTY_TIMEOUT_URLS, SCHOOGLY_CATALOG.firstPartyTimeoutUrls)
})

test('Schoogly backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SCHOOGLY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Schoogly\n',
    catalog: [hydrateProviderCatalogEntry(SCHOOGLY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Schoogly', 'schoogly', 'Schoogly']],
  )
})
