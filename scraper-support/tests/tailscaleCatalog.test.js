import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const tailscaleModulePath = path.resolve(currentDir, '../../scraper/tailscale/script.js')

const loadTailscaleCatalog = async () => {
  try {
    return await import('../../scraper/tailscale/catalog.js')
  } catch {
    assert.fail('Expected Tailscale catalog module at ../../scraper/tailscale/catalog.js')
  }
}

const loadTailscaleModule = async () => {
  try {
    return await import('../../scraper/tailscale/script.js')
  } catch {
    assert.fail('Expected Tailscale scraper module at ../../scraper/tailscale/script.js')
  }
}

test('Tailscale local catalog captures the verified first-party careers handoff and public Greenhouse board', async () => {
  const { TAILSCALE_CATALOG } = await loadTailscaleCatalog()
  const tailscale = await loadTailscaleModule()
  const provider = hydrateProviderCatalogEntry(TAILSCALE_CATALOG)

  assert.equal(provider.source, 'tailscale')
  assert.equal(provider.companyName, 'Tailscale')
  assert.equal(provider.officialBrandName, 'Tailscale')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://tailscale.com/careers')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/tailscale')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/tailscale/jobs')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-plus-single-greenhouse-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tailscale.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /tailscale[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, tailscaleModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tailscale\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/tailscale/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/tailscale\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings|no India openings/i)
  assert.equal(tailscale.PROVIDER_METADATA.source, TAILSCALE_CATALOG.source)
  assert.equal(tailscale.PROVIDER_METADATA.companyName, TAILSCALE_CATALOG.companyName)
  assert.equal(
    tailscale.PROVIDER_METADATA.greenhouseJobsApiUrl,
    TAILSCALE_CATALOG.greenhouseJobsApiUrl,
  )
})

test('getScraperCatalog includes Tailscale as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tailscale')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tailscale')
  assert.equal(provider.companyCareerPage, 'https://tailscale.com/careers')
  assert.equal(provider.companyDomain, 'tailscale.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /tailscale[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Tailscale scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tailscale')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tailscale')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /tailscale[\\/]jobs\.json$/i)
})
