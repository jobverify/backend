import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Effica Automation scraper with the verified blocked-route metadata', () => {
  const catalog = getScraperCatalog()
  const effica = catalog.find((provider) => provider.source === 'efficaautomation')

  assert.ok(effica)
  assert.equal(effica.adapter, 'script')
  assert.equal(effica.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.match(effica.companyCareerPage, /effica\.in\/careers\.html/i)
  assert.equal(effica.companyDomain, 'effica.in')
  assert.deepEqual(effica.checkedBlockedRouteUrls, [
    'https://www.effica.in/',
    'https://www.effica.in/careers.html',
    'https://www.effica.in/contact-us.html',
  ])
  assert.equal(effica.verifiedOn, '2026-08-15')
  assert.match(effica.verifiedSurfaceSummary, /401 Unauthorized/i)
})

test('buildScrapers exposes a runnable Effica Automation scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const effica = scrapers.find((scraper) => scraper.name === 'efficaautomation')

  assert.ok(effica)
  assert.equal(typeof effica.run, 'function')
  assert.match(effica.dryRunFile, /efficaautomation[\\/]jobs\.json$/)
  assert.equal(effica.provider.source, 'efficaautomation')
  assert.equal(effica.provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
})
