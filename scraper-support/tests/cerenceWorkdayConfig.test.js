import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildWorkdayAppliedFacets } from '../myworkday/engine.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const INDIA_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('Cerence local Workday config uses the live jobs API with the lowercase locationCountry facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/cerence.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://cerence.wd5.myworkdayjobs.com/wday/cxs/cerence/Cerence/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://cerence.wd5.myworkdayjobs.com/Cerence',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')

  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://cerence.wd5.myworkdayjobs.com/Cerence',
      INDIA_FACET_ID,
      config.countryFacetParameter,
    ),
    {
      locationCountry: [INDIA_FACET_ID],
    },
  )
})
