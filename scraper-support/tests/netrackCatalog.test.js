import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/netrack/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/netrack/catalog.js')
  } catch {
    assert.fail('Expected Netrack catalog module at ../../scraper/netrack/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/netrack/script.js')
  } catch {
    assert.fail('Expected Netrack scraper module at ../../scraper/netrack/script.js')
  }
}

test('Netrack local catalog captures the verified informational-pages-plus-missing-routes no-public-jobs sentinel state', async () => {
  const { NETRACK_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const netrack = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NETRACK_CATALOG)

  assert.equal(defaultCatalog, NETRACK_CATALOG)
  assert.equal(provider.source, 'netrack')
  assert.equal(provider.companyName, 'Netrack')
  assert.equal(provider.officialBrandName, 'NetRack Enclosures Private Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.netrackindia.com/en')
  assert.equal(provider.companyCareerPage, 'https://www.netrackindia.com/en')
  assert.equal(provider.contactUrl, 'https://www.netrackindia.com/en/contact-0')
  assert.equal(provider.teamUrl, 'https://www.netrackindia.com/en/about-us/about-company/team')
  assert.deepEqual(provider.blockedRouteUrls, [
    'https://www.netrackindia.com/en',
    'https://www.netrackindia.com/en/contact-0',
    'https://www.netrackindia.com/en/about-us/about-company/team',
    'https://www.netrackindia.com/en/careers',
    'https://www.netrackindia.com/careers',
    'https://www.netrackindia.com/en/jobs',
    'https://www.netrackindia.com/jobs',
  ])
  assert.equal(provider.companyDomain, 'netrackindia.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-informational-pages-plus-missing-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-informational-pages+missing-common-hiring-routes+no-trustworthy-public-jobs-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.dryRunFile, /netrack[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.netrackindia\.com\/en\b/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.netrackindia\.com\/en\/contact-0/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.netrackindia\.com\/en\/about-us\/about-company\/team/i)
  assert.match(provider.verifiedSurfaceSummary, /\b404\b/i)
  assert.doesNotMatch(provider.verifiedSurfaceSummary, /Access Denied/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(netrack.PROVIDER_METADATA.source, NETRACK_CATALOG.source)
  assert.equal(netrack.PROVIDER_METADATA.companyName, NETRACK_CATALOG.companyName)
  assert.equal(netrack.PROVIDER_METADATA.companyCareerPage, NETRACK_CATALOG.companyCareerPage)
})

test('Netrack exact backlog name matches directly from local provider metadata', async () => {
  const { NETRACK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Netrack\n',
    catalog: [hydrateProviderCatalogEntry(NETRACK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Netrack', 'netrack', 'Netrack']],
  )
})

test('Netrack hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NETRACK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NETRACK_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netrack')
  assert.equal(provider.companyCareerPage, 'https://www.netrackindia.com/en')
  assert.equal(provider.companyDomain, 'netrackindia.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /netrack[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /netrack[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
