import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Unacademy Darwinbox-backed script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const unacademy = catalog.find((provider) => provider.source === 'unacademy')

  assert.ok(unacademy)
  assert.equal(unacademy.adapter, 'script')
  assert.equal(unacademy.atsPlatform, 'darwinbox')
  assert.match(unacademy.companyCareerPage, /unacademy\.com\/careers/i)
  assert.equal(unacademy.companyDomain, 'unacademy.com')
  assert.equal(unacademy.parser, 'custom-script')
  assert.match(unacademy.modulePath, /unacademy[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Unacademy script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const unacademy = scrapers.find((scraper) => scraper.name === 'unacademy')

  assert.ok(unacademy)
  assert.equal(typeof unacademy.run, 'function')
  assert.equal(unacademy.provider.adapter, 'script')
  assert.equal(unacademy.provider.parser, 'custom-script')
  assert.match(unacademy.provider.companyCareerPage, /unacademy\.com\/careers/i)
})
