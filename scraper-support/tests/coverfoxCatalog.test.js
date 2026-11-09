import assert from 'node:assert/strict'
import test from 'node:test'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCoverfoxModule = async () => {
  try {
    return await import('../../scraper/coverfox/script.js')
  } catch {
    assert.fail('Expected Coverfox scraper module at ../../scraper/coverfox/script.js')
  }
}

test('hydrateProviderCatalogEntry can represent Coverfox as a verified first-party static careers scraper', async () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'coverfox',
    companyName: 'Coverfox',
    adapter: 'script',
    modulePath: '../../scraper/coverfox/script.js',
    companyCareerPage: 'https://www.coverfox.com/careers/',
    paginationStrategy: 'single-first-party-careers-page',
    extractionStrategy: 'verified-first-party-careers-page+inline-accordion-openings+email-application-handoff',
  })

  assert.equal(provider.source, 'coverfox')
  assert.equal(provider.companyName, 'Coverfox')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.coverfox.com/careers/')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+inline-accordion-openings+email-application-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'coverfox.com')
  assert.match(provider.modulePath, /coverfox[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /coverfox[\\/]jobs\.json$/i)

  const coverfox = await loadCoverfoxModule()
  assert.equal(typeof coverfox.createCoverfoxScraper, 'function')
  assert.equal(typeof coverfox.run, 'function')
})
