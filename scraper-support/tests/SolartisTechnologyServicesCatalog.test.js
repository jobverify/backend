import assert from 'node:assert/strict'
import test from 'node:test'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/solartistechnologyservices/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Solartis Technology Services provider contract at ../../scraper/solartistechnologyservices/provider.json')
  }
}

test('Solartis Technology Services provider contract captures the verified generic first-party careers contact page', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'solartistechnologyservices')
  assert.equal(provider.companyName, 'Solartis Technology Services')
  assert.equal(provider.officialBrandName, 'Solartis')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.solartis.com/about/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-contact-page+no-public-job-listings-or-structured-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'solartis.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers-india@solartis.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})
