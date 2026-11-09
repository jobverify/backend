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
const modulePath = path.resolve(currentDir, '../../scraper/atos/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/atos/catalog.js')
  } catch {
    assert.fail('Expected Atos catalog module at ../../scraper/atos/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/atos/script.js')
  } catch {
    assert.fail('Expected Atos scraper module at ../../scraper/atos/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Atos local catalog captures the verified first-party embedded public jobs surface', async () => {
  const { ATOS_CATALOG } = await loadCatalogModule()
  const atos = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ATOS_CATALOG)

  assert.equal(provider.source, 'atos')
  assert.equal(provider.companyName, 'Atos')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://atos.net/en/join-us')
  assert.equal(provider.companyDomain, 'atos.net')
  assert.equal(provider.atsPlatform, 'first-party-wordpress-embedded-jobs-feed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-embedded-jobs-payload',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+embedded-jobs-payload+india-location-map+jobs-atos-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://atos.net/')
  assert.equal(
    provider.jobsWidgetScriptUrl,
    'https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js',
  )
  assert.equal(provider.publicJobDetailHost, 'https://jobs.atos.net/')
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
  )
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atos\.net\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atos\.net\/en\/join-us/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/atos\.net\/wp-content\/plugins\/jobs-atos-net\/js\/jobs\.js/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/jobs\.atos\.net\/job\/Bangalore-Accessibility-Certified-Tester\/1414521533\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b629 public jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b65 India jobs\b/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /atos[\\/]jobs\.json$/i)

  assert.equal(atos.PROVIDER_METADATA.source, provider.source)
  assert.equal(atos.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(atos.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    atos.PROVIDER_METADATA.jobsWidgetScriptUrl,
    provider.jobsWidgetScriptUrl,
  )
})

test('Atos exact backlog name matches from the local provider contract without aliases', async () => {
  const { ATOS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Atos\n',
    catalog: [buildCatalogReadyProvider(ATOS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atos', 'atos', 'Atos']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Atos'), false)
})

test('buildScrapers and company coverage resolve Atos from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'atos')
  const scraper = buildScrapers().find((item) => item.name === 'atos')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Atos')
  assert.equal(provider.companyCareerPage, 'https://atos.net/en/join-us')
  assert.match(scraper.dryRunFile, /atos[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Atos\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atos', 'atos', 'Atos']],
  )
})
