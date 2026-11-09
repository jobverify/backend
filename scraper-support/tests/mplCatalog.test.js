import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mpl/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mpl/catalog.js')
  } catch {
    assert.fail('Expected MPL catalog module at ../../scraper/mpl/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/mpl/script.js')
  } catch {
    assert.fail('Expected MPL scraper module at ../../scraper/mpl/script.js')
  }
}

test('MPL local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { MPL_CATALOG } = await loadCatalogModule()
  const mpl = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MPL_CATALOG)

  assert.equal(provider.source, 'mpl')
  assert.equal(provider.companyName, 'MPL')
  assert.equal(provider.officialBrandName, 'Mobile Premier League (MPL)')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mpl.live/')
  assert.equal(provider.companyCareerPage, 'https://www.mpl.live/')
  assert.equal(provider.companyDomain, 'mpl.live')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage-without-public-jobs-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /mpl[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mpl\.live\//i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(mpl.PROVIDER_METADATA.source, MPL_CATALOG.source)
  assert.equal(mpl.PROVIDER_METADATA.companyName, MPL_CATALOG.companyName)
  assert.equal(mpl.PROVIDER_METADATA.companyCareerPage, MPL_CATALOG.companyCareerPage)
})

test('MPL exact backlog row resolves directly from local provider metadata', async () => {
  const { MPL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MPL\n',
    catalog: [hydrateProviderCatalogEntry(MPL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MPL', 'mpl', 'MPL']],
  )
})

test('MPL hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MPL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MPL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MPL')
  assert.equal(provider.companyCareerPage, 'https://www.mpl.live/')
  assert.equal(provider.companyDomain, 'mpl.live')
  assert.match(provider.modulePath, /mpl[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mpl[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
