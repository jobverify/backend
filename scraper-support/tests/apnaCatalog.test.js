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
const modulePath = path.resolve(currentDir, '../../scraper/apna/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/apna/catalog.js')
  } catch {
    assert.fail('Expected Apna catalog module at ../../scraper/apna/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/apna/script.js')
  } catch {
    assert.fail('Expected Apna scraper module at ../../scraper/apna/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Apna local catalog captures the verified first-party careers handoff to the country-filtered custom-domain Workable feed', async () => {
  const { APNA_CATALOG } = await loadCatalogModule()
  const apna = await loadScraperModule()
  const provider = buildCatalogReadyProvider(APNA_CATALOG)

  assert.equal(provider.source, 'apna')
  assert.equal(provider.companyName, 'Apna')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.apna.co/')
  assert.equal(provider.companyDomain, 'apna.co')
  assert.equal(provider.atsPlatform, 'first-party-custom-domain-workable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-route-plus-country-filtered-markdown-feed',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-handoff+country-filtered-custom-domain-workable-markdown-feed+custom-domain-apply-urls',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://apna.co/')
  assert.equal(provider.careersEntryUrl, 'https://apna.co/careers')
  assert.equal(
    provider.jobsFeedUrl,
    'https://careers.apna.co/jobs.md?location[0][country]=India',
  )
  assert.equal(provider.verifiedJobUrl, 'https://careers.apna.co/_/j/95D6F2526C')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/apna\.co\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.apna\.co\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.apna\.co\/jobs\.md\?location\[0\]\[country\]=India/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /95D6F2526C/i)
  assert.match(provider.verifiedSurfaceSummary, /Workable/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /apna[\\/]jobs\.json$/i)

  assert.equal(apna.PROVIDER_METADATA.source, provider.source)
  assert.equal(apna.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(apna.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(apna.PROVIDER_METADATA.jobsFeedUrl, provider.jobsFeedUrl)
})

test('Apna exact backlog name matches from the local provider contract without aliases', async () => {
  const { APNA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Apna\n',
    catalog: [buildCatalogReadyProvider(APNA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apna', 'apna', 'Apna']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Apna'), false)
})

test('buildScrapers and company coverage resolve Apna from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apna')
  const scraper = buildScrapers().find((item) => item.name === 'apna')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Apna')
  assert.equal(provider.companyCareerPage, 'https://careers.apna.co/')
  assert.match(scraper.dryRunFile, /apna[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apna\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apna', 'apna', 'Apna']],
  )
})
