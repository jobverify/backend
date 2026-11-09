import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Caterpillar Workday local config switches the scraper onto the jobs API with the tenant-specific lowercase country facet', () => {
  const config = loadConfig(
    path.join(testsDir, '../../scraper/caterpillar.workday'),
  )

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://cat.wd5.myworkdayjobs.com/wday/cxs/cat/CaterpillarCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://cat.wd5.myworkdayjobs.com/en-US/CaterpillarCareers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 20)
})
