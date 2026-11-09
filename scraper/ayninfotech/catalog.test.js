import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('AYN InfoTech is registered as the verified untrusted-domain sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ayninfotech')

  assert.ok(provider)
  assert.equal(provider.companyName, 'AYN InfoTech')
  assert.equal(provider.homepageUrl, 'https://www.ayninfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.ayninfotech.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-untrusted-domain')
  assert.equal(provider.paginationStrategy, 'homepage-and-common-career-route-sentinel')
  assert.equal(provider.extractionStrategy, 'verified-untrusted-first-party-domain-sentinel')
  assert.equal(provider.companyDomain, 'ayninfotech.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /bigskyworldview/i)
  assert.match(provider.modulePath, /ayninfotech[\\/]script\.js$/i)
})

test('AYN InfoTech is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ayninfotech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ayninfotech')
  assert.match(scraper.dryRunFile, /ayninfotech[\\/]jobs\.json$/i)
})
