import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CommerceIQ as a Greenhouse apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const commerceIq = catalog.find((provider) => provider.source === 'commerceiq')

  assert.ok(commerceIq)
  assert.equal(commerceIq.adapter, 'apiPortal')
  assert.equal(commerceIq.atsPlatform, 'greenhouse')
  assert.equal(commerceIq.companyCareerPage, 'https://www.commerceiq.ai/careers')
  assert.equal(commerceIq.companyDomain, 'commerceiq.ai')
  assert.match(
    commerceIq.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/commerceiq\/jobs/i,
  )
  assert.equal(commerceIq.config.resultFilter.include[0].field, 'location')
  assert.match(String(commerceIq.config.resultFilter.include[0].pattern), /india/i)
  assert.equal(commerceIq.config.resultFilter.exclude[0].field, 'title')
  assert.match(String(commerceIq.config.resultFilter.exclude[0].pattern), /talent community/i)
})

test('buildScrapers exposes a runnable CommerceIQ scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const commerceIq = scrapers.find((scraper) => scraper.name === 'commerceiq')

  assert.ok(commerceIq)
  assert.equal(typeof commerceIq.run, 'function')
  assert.match(commerceIq.dryRunFile, /commerceiq[\\/]jobs\.json$/)
  assert.equal(commerceIq.provider.source, 'commerceiq')
  assert.equal(commerceIq.provider.atsPlatform, 'greenhouse')
})
