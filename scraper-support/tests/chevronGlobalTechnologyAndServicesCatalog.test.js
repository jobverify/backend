import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATS_PLATFORM,
  CAREER_PAGE_URL,
  COMPANY_NAME,
  LEGAL_ENTITY_NAME,
  SOURCE,
  buildSearchUrl,
} from '../../scraper/chevronglobaltechnologyandservices/script.js'

test('Chevron Global Technology and Services exports stable public contract metadata', () => {
  assert.equal(COMPANY_NAME, 'Chevron Global Technology and Services')
  assert.equal(LEGAL_ENTITY_NAME, 'Chevron Global Technology and Services Private Limited')
  assert.equal(SOURCE, 'chevronglobaltechnologyandservices')
  assert.equal(ATS_PLATFORM, 'talentbrew-radancy')
  assert.equal(
    CAREER_PAGE_URL,
    'https://careers.chevron.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://careers.chevron.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})
