import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the PayPal and Ericsson Eightfold apiPortal providers with official metadata', () => {
  const catalog = getScraperCatalog()
  const paypal = catalog.find((provider) => provider.source === 'paypal')
  const ericsson = catalog.find((provider) => provider.source === 'ericsson')

  assert.ok(paypal)
  assert.equal(paypal.adapter, 'apiPortal')
  assert.equal(paypal.atsPlatform, 'eightfold')
  assert.match(paypal.companyCareerPage, /careers\.pypl\.com\/home/i)
  assert.equal(paypal.companyDomain, 'careers.pypl.com')
  assert.match(paypal.config.discovery.listingApiUrl, /paypal\.eightfold\.ai\/api\/pcsx\/search/i)

  assert.ok(ericsson)
  assert.equal(ericsson.adapter, 'apiPortal')
  assert.equal(ericsson.atsPlatform, 'eightfold')
  assert.match(ericsson.companyCareerPage, /jobs\.ericsson\.com\/careers/i)
  assert.equal(ericsson.companyDomain, 'jobs.ericsson.com')
  assert.match(ericsson.config.discovery.listingApiUrl, /jobs\.ericsson\.com\/api\/pcsx\/search/i)
})

test('buildScrapers exposes runnable PayPal and Ericsson Eightfold scrapers without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const paypal = scrapers.find((scraper) => scraper.name === 'paypal')
  const ericsson = scrapers.find((scraper) => scraper.name === 'ericsson')

  assert.ok(paypal)
  assert.equal(typeof paypal.run, 'function')
  assert.match(paypal.dryRunFile, /paypal[\\/]jobs\.json$/)
  assert.equal(paypal.provider.source, 'paypal')
  assert.equal(paypal.provider.atsPlatform, 'eightfold')

  assert.ok(ericsson)
  assert.equal(typeof ericsson.run, 'function')
  assert.match(ericsson.dryRunFile, /ericsson[\\/]jobs\.json$/)
  assert.equal(ericsson.provider.source, 'ericsson')
  assert.equal(ericsson.provider.atsPlatform, 'eightfold')
})
