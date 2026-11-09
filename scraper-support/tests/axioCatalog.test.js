import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/axio/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/axio/catalog.js')
  } catch {
    assert.fail('Expected Axio catalog module at ../../scraper/axio/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/axio/script.js')
  } catch {
    assert.fail('Expected Axio scraper module at ../../scraper/axio/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Axio local catalog captures the verified first-party Darwinbox handoff surface', async () => {
  const { AXIO_CATALOG } = await loadCatalogModule()
  const axio = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AXIO_CATALOG)

  assert.equal(provider.source, 'axio')
  assert.equal(provider.companyName, 'Axio')
  assert.equal(provider.officialBrandName, 'axio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.axio.co.in/about-us')
  assert.equal(provider.homepageUrl, 'https://www.axio.co.in/')
  assert.equal(provider.companyDomain, 'axio.co.in')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-about-us-page+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://axiofinance.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://axiofinance.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.axio\.co\.in\/about-us/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/axiofinance\.darwinbox\.in\/ms\/candidate\/careers/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/axiofinance\.darwinbox\.in\/jobs/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/axiofinance\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /axio[\\/]jobs\.json$/i)

  assert.equal(axio.PROVIDER_METADATA.source, provider.source)
  assert.equal(axio.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(axio.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    axio.PROVIDER_METADATA.officialCareersHandoffUrl,
    provider.officialCareersHandoffUrl,
  )
  assert.equal(axio.PROVIDER_METADATA.darwinboxOrigin, provider.darwinboxOrigin)
})

test('Axio exact backlog name matches from the local provider contract without aliases', async () => {
  const { AXIO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Axio\n',
    catalog: [buildCatalogReadyProvider(AXIO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Axio', 'axio', 'Axio']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Axio'), false)
})

test('buildScrapers and company coverage resolve Axio from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'axio')
  const scraper = buildScrapers().find((item) => item.name === 'axio')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Axio')
  assert.equal(provider.companyCareerPage, 'https://www.axio.co.in/about-us')
  assert.match(scraper.dryRunFile, /axio[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Axio\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Axio', 'axio', 'Axio']],
  )
})
