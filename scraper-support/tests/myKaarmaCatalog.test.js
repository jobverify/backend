import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const myKaarmaModulePath = path.resolve(currentDir, '../../scraper/mykaarma/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mykaarma/catalog.js')
  } catch {
    assert.fail('Expected MyKaarma catalog module at ../../scraper/mykaarma/catalog.js')
  }
}

const loadMyKaarmaModule = async () => {
  try {
    return await import('../../scraper/mykaarma/script.js')
  } catch {
    assert.fail('Expected MyKaarma scraper module at ../../scraper/mykaarma/script.js')
  }
}

test('MyKaarma local catalog captures the verified first-party careers page and Rippling board metadata', async () => {
  const { MYKAARMA_CATALOG } = await loadCatalogModule()
  const myKaarma = await loadMyKaarmaModule()
  const provider = hydrateProviderCatalogEntry(MYKAARMA_CATALOG)

  assert.equal(provider.source, 'mykaarma')
  assert.equal(provider.companyName, 'MyKaarma')
  assert.equal(provider.officialBrandName, 'myKaarma')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://mykaarma.com/')
  assert.equal(provider.companyCareerPage, 'https://mykaarma.com/careers/')
  assert.equal(provider.officialCareersLandingUrl, 'https://mykaarma.com/careers/')
  assert.equal(
    provider.ripplingEmbedUrl,
    'https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F',
  )
  assert.equal(provider.ripplingBoardUrl, 'https://ats.rippling.com/mykaarma/jobs')
  assert.equal(provider.ripplingBoardSlug, 'mykaarma')
  assert.equal(provider.atsPlatform, 'rippling')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-rippling-embed-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+rippling-embed-next-data+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mykaarma.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mykaarma[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mykaarma\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/ats\.rippling\.com\/embed\/mykaarma\/jobs\?s=https%3A%2F%2Fmykaarma\.com%2Fcareers%2F/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Finance and Accounting Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /NOIDA, India/i)
  assert.equal(provider.modulePath, myKaarmaModulePath)

  assert.equal(myKaarma.PROVIDER_METADATA.source, MYKAARMA_CATALOG.source)
  assert.equal(myKaarma.PROVIDER_METADATA.companyName, MYKAARMA_CATALOG.companyName)
  assert.equal(
    myKaarma.PROVIDER_METADATA.ripplingEmbedUrl,
    MYKAARMA_CATALOG.ripplingEmbedUrl,
  )
})
