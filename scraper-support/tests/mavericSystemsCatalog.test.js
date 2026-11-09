import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Maveric Systems as a verified SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mavericsystems')

  assert.ok(provider, 'Expected Maveric Systems provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Maveric Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://maveric-systems.com/careers/')
  assert.equal(provider.companyDomain, 'maveric-systems.com')
  assert.match(provider.modulePath, /mavericsystems[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Maveric Systems scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mavericsystems')

  assert.ok(scraper, 'Expected Maveric Systems scraper to be available')
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mavericsystems[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'mavericsystems')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
