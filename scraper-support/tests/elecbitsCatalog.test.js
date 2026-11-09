import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Elecbits scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const elecbits = catalog.find((provider) => provider.source === 'elecbits')

  assert.ok(elecbits)
  assert.equal(elecbits.adapter, 'script')
  assert.equal(elecbits.atsPlatform, 'official-company-careers')
  assert.match(elecbits.companyCareerPage, /elecbits\.in\/careers/i)
  assert.equal(elecbits.companyDomain, 'elecbits.in')
  assert.equal(elecbits.verifiedOn, '2026-08-14')
  assert.equal(elecbits.verifiedPublicJobCount, 4)
  assert.equal(elecbits.verifiedIndiaJobCount, 4)
  assert.match(elecbits.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(elecbits.verifiedSurfaceSummary, /Careers at Elecbits Join Electronics Innovation Team/i)
  assert.match(elecbits.verifiedSurfaceSummary, /https:\/\/elecbits\.in\/elecbits-jd-sales\//i)
})

test('buildScrapers exposes a runnable Elecbits scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const elecbits = scrapers.find((scraper) => scraper.name === 'elecbits')

  assert.ok(elecbits)
  assert.equal(typeof elecbits.run, 'function')
  assert.match(elecbits.dryRunFile, /elecbits[\\/]jobs\.json$/)
  assert.equal(elecbits.provider.source, 'elecbits')
  assert.equal(elecbits.provider.atsPlatform, 'official-company-careers')
})
