import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractSearchResults,
} from '../../scraper/siemens/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'siemens',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Mentor Graphics alias recommendation depends on the Siemens public search route staying stable', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.siemens.com/en_US/externaljobs/SearchJobs',
  )
  assert.equal(
    buildSearchUrl({ offset: 6 }),
    'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/?folderRecordsPerPage=6&folderOffset=6',
  )
})

test('Mentor Graphics alias recommendation reuses Siemens India job extraction without a duplicate scraper', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Siemens')
  assert.equal(jobs[0].title, 'Solution Engineering - Control and Protection Testing')
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[1].location, 'Gurugram, Haryana, India')
})
