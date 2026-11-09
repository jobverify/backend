import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Nissan Digital India on the official Workday-backed careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nissandigitalindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Nissan Digital India')
  assert.equal(provider.companyCareerPage, 'https://www.nissanmotor.jobs/ami/india/ndi/careers.html')
  assert.equal(provider.companyDomain, 'nissanmotor.jobs')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /alliance\.wd3\.myworkdayjobs\.com\/en-US\/nissanjobs/i)
})

test('buildScrapers exposes a runnable Nissan Digital India Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nissandigitalindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nissandigitalindia.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'nissandigitalindia')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})
