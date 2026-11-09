import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const gatiModulePath = path.resolve(currentDir, '../../scraper/gati/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gati/catalog.js')
  } catch {
    assert.fail('Expected Gati catalog module at ../../scraper/gati/catalog.js')
  }
}

const loadGatiModule = async () => {
  try {
    return await import('../../scraper/gati/script.js')
  } catch {
    assert.fail('Expected Gati scraper module at ../../scraper/gati/script.js')
  }
}

test('Gati local catalog captures the verified redirected first-party Darwinbox sentinel surface', async () => {
  const { GATI_CATALOG } = await loadCatalogModule()
  const gati = await loadGatiModule()

  assert.equal(GATI_CATALOG.source, 'gati')
  assert.equal(GATI_CATALOG.companyName, 'Gati')
  assert.equal(GATI_CATALOG.adapter, 'script')
  assert.equal(GATI_CATALOG.homepageUrl, 'https://www.gati.com/')
  assert.equal(GATI_CATALOG.companyCareerPage, 'https://www.allcargologistics.com/about-us/careers')
  assert.equal(GATI_CATALOG.companyDomain, 'allcargologistics.com')
  assert.equal(GATI_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(GATI_CATALOG.countryFilter, 'India')
  assert.equal(
    GATI_CATALOG.paginationStrategy,
    'gati-homepage-redirect-plus-parent-careers-page-plus-broken-darwinbox-monitor',
  )
  assert.equal(
    GATI_CATALOG.extractionStrategy,
    'verified-gati-homepage-redirect+verified-parent-careers-page+broken-darwinbox-tenant-return-empty',
  )
  assert.equal(GATI_CATALOG.parser, 'custom-script')
  assert.equal(GATI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    GATI_CATALOG.officialCareersHandoffUrl,
    'https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(GATI_CATALOG.darwinboxOrigin, 'https://gatikwe.darwinbox.in')
  assert.equal(GATI_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(GATI_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GATI_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.gati\.com\//i)
  assert.match(
    GATI_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.allcargologistics\.com\/about-us\/careers/i,
  )
  assert.match(
    GATI_CATALOG.verifiedSurfaceSummary,
    /https:\/\/allcargologistics\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home/i,
  )
  assert.match(GATI_CATALOG.verifiedSurfaceSummary, /invalid subdomain: gatikwe/i)
  assert.equal(GATI_CATALOG.modulePath, gatiModulePath)

  assert.equal(gati.PROVIDER_METADATA.source, GATI_CATALOG.source)
  assert.equal(gati.PROVIDER_METADATA.companyName, GATI_CATALOG.companyName)
  assert.equal(gati.PROVIDER_METADATA.homepageUrl, GATI_CATALOG.homepageUrl)
  assert.equal(gati.PROVIDER_METADATA.companyCareerPage, GATI_CATALOG.companyCareerPage)
  assert.equal(
    gati.PROVIDER_METADATA.officialCareersHandoffUrl,
    GATI_CATALOG.officialCareersHandoffUrl,
  )
  assert.equal(gati.PROVIDER_METADATA.darwinboxOrigin, GATI_CATALOG.darwinboxOrigin)
})

test('getScraperCatalog includes Gati as a verified redirected Darwinbox sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gati')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gati')
  assert.equal(provider.companyCareerPage, 'https://www.allcargologistics.com/about-us/careers')
  assert.equal(provider.companyDomain, 'allcargologistics.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(provider.modulePath, /gati[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gati scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gati')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gati')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /gati[\\/]jobs\.json$/i)
})
