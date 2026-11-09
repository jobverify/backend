import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Intelligence Bureau with the verified MHA vacancies surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intelligencebureau')

  assert.ok(provider, 'Expected an Intelligence Bureau provider entry in the scraper catalog')
  assert.equal(provider.companyName, 'Intelligence Bureau')
  assert.equal(provider.companyCareerPage, 'https://www.mha.gov.in/en/notifications/vacancies')
  assert.equal(provider.atsPlatform, 'official-government-careers')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'verified-mha-vacancies-page+ib-notice-filtering')
  assert.equal(provider.companyDomain, 'mha.gov.in')
})
