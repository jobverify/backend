import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const kooModulePath = path.resolve(currentDir, '../../scraper/koo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/koo/catalog.js')
  } catch {
    assert.fail('Expected Koo catalog module at ../../scraper/koo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/koo/script.js')
  } catch {
    assert.fail('Expected Koo scraper module at ../../scraper/koo/script.js')
  }
}

test('Koo local catalog captures the verified broken first-party domain sentinel contract', async () => {
  const { KOO_CATALOG } = await loadCatalogModule()
  const koo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KOO_CATALOG)

  assert.equal(KOO_CATALOG.source, 'koo')
  assert.equal(KOO_CATALOG.companyName, 'Koo')
  assert.equal(KOO_CATALOG.officialBrandName, 'Koo')
  assert.equal(KOO_CATALOG.adapter, 'script')
  assert.equal(KOO_CATALOG.modulePath, kooModulePath)
  assert.equal(KOO_CATALOG.dryRunFile, 'koo/jobs.json')
  assert.equal(KOO_CATALOG.companyCareerPage, 'https://www.kooapp.com/')
  assert.equal(KOO_CATALOG.homepageUrl, 'https://www.kooapp.com/')
  assert.equal(KOO_CATALOG.alternateHomepageUrl, 'https://kooapp.com/')
  assert.deepEqual(KOO_CATALOG.verifiedBrokenRouteUrls, [
    'https://www.kooapp.com/careers',
    'https://www.kooapp.com/jobs',
    'https://www.kooapp.com/about-us',
    'https://www.kooapp.com/contact-us',
    'https://www.kooapp.com/robots.txt',
    'https://www.kooapp.com/sitemap.xml',
  ])
  assert.equal(KOO_CATALOG.companyDomain, 'kooapp.com')
  assert.equal(KOO_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KOO_CATALOG.countryFilter, 'India')
  assert.equal(
    KOO_CATALOG.paginationStrategy,
    'verified-broken-first-party-domain-validation',
  )
  assert.equal(
    KOO_CATALOG.extractionStrategy,
    'verified-broken-first-party-domain+common-routes-return-empty',
  )
  assert.equal(KOO_CATALOG.parser, 'custom-script')
  assert.equal(KOO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KOO_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KOO_CATALOG.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(KOO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.kooapp\.com\//i)
  assert.match(KOO_CATALOG.verifiedSurfaceSummary, /https:\/\/kooapp\.com\//i)
  assert.match(KOO_CATALOG.verifiedSurfaceSummary, /wix/i)
  assert.match(KOO_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(provider.source, 'koo')
  assert.equal(provider.companyName, 'Koo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kooapp.com/')
  assert.equal(provider.companyDomain, 'kooapp.com')
  assert.match(provider.modulePath, /koo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /koo[\\/]jobs\.json$/i)

  assert.equal(koo.PROVIDER_METADATA.source, provider.source)
  assert.equal(koo.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Koo exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { KOO_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Koo\n',
    catalog: [hydrateProviderCatalogEntry(KOO_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Koo', 'koo', 'Koo']],
  )
})
