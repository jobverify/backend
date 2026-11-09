import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Silicon Labs India Workday local config uses the jobs API against the public tenant', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/siliconlabsindia.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://silabs.wd1.myworkdayjobs.com/wday/cxs/silabs/SiliconlabsCareers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://silabs.wd1.myworkdayjobs.com/SiliconlabsCareers',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 20)
})
