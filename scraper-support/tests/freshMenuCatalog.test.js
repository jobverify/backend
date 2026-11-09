import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/freshmenu/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/freshmenu/catalog.js')
  } catch {
    assert.fail('Expected FreshMenu catalog module at ../../scraper/freshmenu/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/freshmenu/script.js')
  } catch {
    assert.fail('Expected FreshMenu scraper module at ../../scraper/freshmenu/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('FreshMenu local catalog captures the verified no-public-jobs apex-domain surface', async () => {
  const { FRESHMENU_CATALOG } = await loadCatalogModule()
  const freshMenu = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FRESHMENU_CATALOG)

  assert.equal(provider.source, 'freshmenu')
  assert.equal(provider.companyName, 'FreshMenu')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://freshmenu.com/')
  assert.equal(provider.aboutPageUrl, 'https://freshmenu.com/about')
  assert.equal(provider.checkedMissingRouteUrls.length, 2)
  assert.deepEqual(provider.checkedMissingRouteUrls, [
    'https://freshmenu.com/careers',
    'https://freshmenu.com/jobs',
  ])
  assert.equal(provider.companyDomain, 'freshmenu.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-about-page-plus-missing-career-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-apex-homepage-no-public-jobs+verified-generic-app-shell-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/freshmenu\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/freshmenu\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/freshmenu\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/freshmenu\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /branded freshmenu vite app shell/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /freshmenu[\\/]jobs\.json$/i)

  assert.equal(freshMenu.PROVIDER_METADATA.source, provider.source)
  assert.equal(freshMenu.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(freshMenu.PROVIDER_METADATA.aboutPageUrl, provider.aboutPageUrl)
})

test('FreshMenu exact backlog row matches from the local provider contract without aliases', async () => {
  const { FRESHMENU_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'FreshMenu\n',
    catalog: [buildCatalogReadyProvider(FRESHMENU_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FreshMenu', 'freshmenu', 'FreshMenu']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'FreshMenu'), false)
})
