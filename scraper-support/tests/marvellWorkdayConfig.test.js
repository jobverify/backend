import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Marvell Workday local config switches the scraper onto the jobs API without forcing the generic country facet', () => {
  const config = loadConfig(
    path.join(testsDir, '../../scraper/marvell.workday'),
  )

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://marvell.wd1.myworkdayjobs.com/wday/cxs/marvell/MarvellCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers',
  )
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, 'India')
  assert.match(config.locationPattern, /india|bengaluru|bangalore|pune|hyderabad|noida|gandhinagar/i)
})
