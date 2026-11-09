import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fanclashModulePath = path.resolve(currentDir, '../../scraper/fanclash/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fanclash/catalog.js')
  } catch {
    assert.fail('Expected Fanclash catalog module at ../../scraper/fanclash/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fanclash/script.js')
  } catch {
    assert.fail('Expected Fanclash scraper module at ../../scraper/fanclash/script.js')
  }
}

test('Fanclash local catalog captures the verified parked-domain, 404-route, and unresolved-host no-public-jobs contract', async () => {
  const { FANCLASH_CATALOG } = await loadCatalogModule()
  const fanclash = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(FANCLASH_CATALOG)

  assert.equal(provider.source, 'fanclash')
  assert.equal(provider.companyName, 'Fanclash')
  assert.equal(provider.officialBrandName, 'FanClash')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://fanclash.com/')
  assert.equal(provider.companyCareerPage, 'https://fanclash.com/')
  assert.deepEqual(provider.parkedHomepageUrls, [
    'https://fanclash.com/',
    'https://www.fanclash.com/',
  ])
  assert.deepEqual(provider.checked404RouteUrls, [
    'https://fanclash.com/careers',
    'https://www.fanclash.com/careers',
    'https://fanclash.com/jobs',
    'https://www.fanclash.com/jobs',
    'https://fanclash.com/robots.txt',
    'https://www.fanclash.com/robots.txt',
    'https://fanclash.com/sitemap.xml',
    'https://www.fanclash.com/sitemap.xml',
  ])
  assert.deepEqual(provider.unresolvedFirstPartyUrls, [
    'https://fanclash.in/',
    'https://www.fanclash.in/',
    'https://fanclash.in/careers',
    'https://www.fanclash.in/careers',
  ])
  assert.equal(provider.parkedDomainRedirectUrl, 'https://www.atom.com/name/FanClash')
  assert.equal(provider.companyDomain, 'fanclash.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'parked-domain-plus-missing-routes-plus-unresolved-host-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-parked-first-party-domain+verified-404-careers-jobs-crawl-routes+verified-unresolved-alternate-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, fanclashModulePath)
  assert.match(provider.dryRunFile, /fanclash[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fanclash\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.atom\.com\/name\/FanClash/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.com\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fanclash\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /dns/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(fanclash.PROVIDER_METADATA.source, provider.source)
  assert.equal(fanclash.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fanclash.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Fanclash exact backlog row matches directly from the local provider contract without an alias entry', async () => {
  const { FANCLASH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fanclash\n',
    catalog: [hydrateProviderCatalogEntry(FANCLASH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fanclash', 'fanclash', 'Fanclash']],
  )
})
