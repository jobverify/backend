import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('o9 Solutions Workday local config uses the jobs API against the public external tenant', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/o9solutions.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://o9solutions.wd5.myworkdayjobs.com/wday/cxs/o9solutions/o9SolutionsExternal/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://o9solutions.wd5.myworkdayjobs.com/en-US/o9SolutionsExternal',
  )
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, undefined)
  assert.equal(config.maxPages, 20)
})
