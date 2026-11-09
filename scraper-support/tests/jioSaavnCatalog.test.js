import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/jiosaavn/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jiosaavn/catalog.js')
  } catch {
    assert.fail('Expected JioSaavn catalog module at ../../scraper/jiosaavn/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/jiosaavn/script.js')
  } catch {
    assert.fail('Expected JioSaavn scraper module at ../../scraper/jiosaavn/script.js')
  }
}

test('JioSaavn local catalog captures the verified first-party empty careers surface', async () => {
  const { JIOSAAVN_CATALOG } = await loadCatalogModule()
  const jiosaavn = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(JIOSAAVN_CATALOG)

  assert.equal(provider.source, 'jiosaavn')
  assert.equal(provider.companyName, 'JioSaavn')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://corporate.saavn.com/')
  assert.equal(provider.companyCareerPage, 'https://corporate.saavn.com/careers')
  assert.equal(provider.companyDomain, 'corporate.saavn.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-empty-board-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-find-your-gig-zero-openings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /jiosaavn[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.saavn\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Find Your Gig/i)
  assert.match(provider.verifiedSurfaceSummary, /Mumbai/i)
  assert.match(provider.verifiedSurfaceSummary, /0 Openings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'JioSaavn'), false)

  assert.equal(jiosaavn.PROVIDER_METADATA.source, provider.source)
  assert.equal(jiosaavn.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(jiosaavn.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('JioSaavn exact backlog row matches directly from the local provider contract without aliases', async () => {
  const { JIOSAAVN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'JioSaavn\n',
    catalog: [hydrateProviderCatalogEntry(JIOSAAVN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JioSaavn', 'jiosaavn', 'JioSaavn']],
  )
})

test('getScraperCatalog includes JioSaavn as a verified empty-board provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jiosaavn')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'JioSaavn')
  assert.equal(provider.companyCareerPage, 'https://corporate.saavn.com/careers')
  assert.equal(provider.companyDomain, 'corporate.saavn.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.match(provider.modulePath, /jiosaavn[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable JioSaavn scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jiosaavn')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jiosaavn')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers-empty-board')
  assert.match(scraper.dryRunFile, /jiosaavn[\\/]jobs\.json$/i)
})
