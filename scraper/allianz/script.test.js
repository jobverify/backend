import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobDetailUrl,
  buildSearchResultsPageUrl,
  extractSearchResults,
} from './script.js'

test('Allianz scraper uses the official Phenom search route and global job URL pattern', () => {
  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.allianz.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(40),
    'https://careers.allianz.com/global/en/search-results?from=40',
  )
  assert.equal(
    buildJobDetailUrl({ reqId: '90730', title: 'Integration Architect _1915' }),
    'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  )
})

test('Allianz scraper filters to runnable Phenom listings with canonical source URLs', () => {
  const jobs = extractSearchResults({
    jobs: [
      {
        reqId: '90730',
        title: 'Integration Architect _1915',
        cityStateCountry: 'India',
        country: 'India',
        category: 'IT & Tech Engineering',
        type: 'Full-time',
      },
      {
        reqId: 'missing-title',
        cityStateCountry: 'India',
        country: 'India',
      },
    ],
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '90730')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  )
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].city, 'India')
})
