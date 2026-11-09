import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const samunnatiModulePath = path.resolve(currentDir, '../../scraper/samunnati/script.js')

const loadSamunnatiCatalog = async () => {
  try {
    return await import('../../scraper/samunnati/catalog.js')
  } catch {
    assert.fail('Expected Samunnati catalog module at ../../scraper/samunnati/catalog.js')
  }
}

test('Samunnati local catalog captures the verified first-party Darwinbox handoff surface', async () => {
  const {
    SAMUNNATI_CATALOG,
    default: defaultCatalog,
  } = await loadSamunnatiCatalog()
  const provider = hydrateProviderCatalogEntry(SAMUNNATI_CATALOG)

  assert.equal(defaultCatalog, SAMUNNATI_CATALOG)
  assert.equal(provider.source, 'samunnati')
  assert.equal(provider.companyName, 'Samunnati')
  assert.equal(provider.officialBrandName, 'Samunnati')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://samunnati.com/')
  assert.equal(provider.homepageUrl, 'https://samunnati.com/')
  assert.equal(provider.officialAboutUrl, 'https://samunnati.com/about-us-sam/')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://samunnati.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://samunnati.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.companyDomain, 'samunnati.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage-and-about-page+darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, samunnatiModulePath)
  assert.match(provider.dryRunFile, /samunnati[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/samunnati\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/samunnati\.com\/about-us-sam\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/samunnati\.darwinbox\.in\/ms\/candidate\/careers/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Darwinbox/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Samunnati'), false)
})

test('Samunnati exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SAMUNNATI_CATALOG } = await loadSamunnatiCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Samunnati\n',
    catalog: [hydrateProviderCatalogEntry(SAMUNNATI_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Samunnati', 'samunnati', 'Samunnati']],
  )
})
