import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Payatu as an official-careers handoff to the active Bandit public board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'payatu')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Payatu')
  assert.match(provider.modulePath, /payatu[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://payatu.ai/career')
  assert.equal(provider.companyDomain, 'payatu.ai')
  assert.equal(provider.atsPlatform, 'official-company-bandit-fit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'employer-linked-server-rendered-active-board')
  assert.equal(provider.extractionStrategy, 'verified-payatu-domain-migration+employer-linked-bandit-fit-board+all-live-role-and-application-details+confirmed-india')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
})

test('buildScrapers exposes a runnable Payatu scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'payatu')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /payatu[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'payatu')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.provider.modulePath, /payatu[\\/]script\.js$/i)
  assert.equal(scraper.provider.atsPlatform, 'official-company-bandit-fit')
  assert.equal(scraper.provider.countryFilter, 'India')
  assert.equal(scraper.provider.paginationStrategy, 'employer-linked-server-rendered-active-board')
  assert.equal(scraper.provider.extractionStrategy, 'verified-payatu-domain-migration+employer-linked-bandit-fit-board+all-live-role-and-application-details+confirmed-india')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.equal(scraper.provider.companyCareerPage, 'https://payatu.ai/career')
  assert.equal(scraper.provider.companyDomain, 'payatu.ai')
})
