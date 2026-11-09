import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobDetailUrl,
  buildSearchResultsPageUrl,
} from './script.js'

test('Micro Focus scraper uses the verified OpenText Phenom search route and job URL pattern', () => {
  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.opentext.com/us/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(40),
    'https://careers.opentext.com/us/en/search-results?from=40',
  )
  assert.equal(
    buildJobDetailUrl({ reqId: '12345', title: 'Senior Engineer' }),
    'https://careers.opentext.com/us/en/job/12345/Senior-Engineer',
  )
})
