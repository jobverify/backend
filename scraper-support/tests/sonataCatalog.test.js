import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Sonata official job-listings script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const sonata = catalog.find((provider) => provider.source === 'sonata')

  assert.ok(sonata)
  assert.equal(sonata.adapter, 'script')
  assert.equal(sonata.atsPlatform, 'first-party-drupal-table+darwinbox-apply-handoff')
  assert.match(sonata.companyCareerPage, /sonata-software\.com\/careers/i)
  assert.equal(sonata.jobListingsUrl, 'https://dev2024.sonata-software.com/careers/job-postings')
  assert.equal(sonata.companyDomain, 'sonata-software.com')
  assert.equal(sonata.parser, 'custom-script')
  assert.match(sonata.modulePath, /sonata[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sonata script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const sonata = scrapers.find((scraper) => scraper.name === 'sonata')

  assert.ok(sonata)
  assert.equal(typeof sonata.run, 'function')
  assert.equal(sonata.provider.adapter, 'script')
  assert.equal(sonata.provider.parser, 'custom-script')
  assert.match(sonata.provider.companyCareerPage, /sonata-software\.com\/careers/i)
  assert.equal(sonata.provider.jobListingsUrl, 'https://dev2024.sonata-software.com/careers/job-postings')
})
