import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('Medi Assist Insurance TPA Pvt. Ltd. is registered against the official first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mediassist')

  assert.ok(provider, 'Expected Medi Assist Insurance TPA Pvt. Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Medi Assist Insurance TPA Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.mediassist.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+html-job-cards+detail-pages+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mediassist.in')
  assert.match(provider.modulePath, /mediassist[\\/]script\.js$/i)
})

