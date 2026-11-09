import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kathir Sudhir Automation is registered in the custom provider catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kathirsudhirautomation')

  assert.ok(provider, 'Expected Kathir Sudhir Automation provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kathir Sudhir Automation')
  assert.equal(provider.companyCareerPage, 'https://www.kathirsudhirautomation.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-homepage+legacy-role-sections+reject-current-inline-roles-with-unverified-geography')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kathirsudhirautomation.com')
  assert.match(provider.modulePath, /kathirsudhirautomation[\\/]script\.js$/i)
})

test('Kathir Sudhir Automation is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kathirsudhirautomation')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kathir Sudhir Automation scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kathirsudhirautomation')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.kathirsudhirautomation.com/career')
  assert.match(scraper.dryRunFile, /kathirsudhirautomation[\\/]jobs\.json$/i)
})
