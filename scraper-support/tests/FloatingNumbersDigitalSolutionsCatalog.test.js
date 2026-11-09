import assert from 'node:assert/strict'
import test from 'node:test'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/floatingnumbersdigitalsolutions/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Floating Numbers Digital Solutions provider contract at ../../scraper/floatingnumbersdigitalsolutions/provider.json')
  }
}

test('Floating Numbers Digital Solutions provider contract captures the verified first-party marketing site with no public careers surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'floatingnumbersdigitalsolutions')
  assert.equal(provider.companyName, 'Floating Numbers Digital Solutions')
  assert.equal(provider.officialBrandName, 'Floating Numbers')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.floatingnumbers.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-marketing-homepage+no-careers-route-or-public-job-listings',
  )
  assert.equal(provider.companyDomain, 'floatingnumbers.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /best content moderation company in india/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})
