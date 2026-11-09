import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Course5i using its official C5i careers page', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'course5i')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Course5i')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.c5i.ai/careers/')
  assert.equal(provider.companyDomain, 'c5i.ai')
  assert.equal(provider.paginationStrategy, 'email-application-no-public-opening-records')
  assert.equal(provider.extractionStrategy, 'official-careers-page+email-application-no-public-opening-details')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /course5i[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'course5i')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})
