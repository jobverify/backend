import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  BASE_URL,
  CAREER_PAGE_URL,
  buildScraperOptions,
  run,
} from './script.js'
import { buildWorkdayAppliedFacets } from '../../scraper-support/myworkday/engine.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

test('uses Alphawave Semi India official careers page and India-filtered Workday source', () => {
  assert.equal(CAREER_PAGE_URL, 'https://awavesemi.com/careers/india-job-openings/')
  assert.match(BASE_URL, /^https:\/\/alphawave\.wd10\.myworkdayjobs\.com\/Alphawave_External/)
  assert.match(BASE_URL, /locations=d9b1a3a6e54d1008421b5a4934ad0000/)
  assert.match(BASE_URL, /locations=f3ca14c95ae81010b95985e62beb0000/)
})

test('loads the Alphawave Workday jobs API configuration', () => {
  const config = loadConfig(scraperDir)

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://alphawave.wd10.myworkdayjobs.com/wday/cxs/alphawave/Alphawave_External/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://alphawave.wd10.myworkdayjobs.com/Alphawave_External')
  assert.equal(config.locationCountry, null)
})

test('builds the Alphawave jobs API request with only verified location facets', () => {
  const config = loadConfig(scraperDir)
  const options = buildScraperOptions()
  const countryId = Object.prototype.hasOwnProperty.call(config, 'locationCountry')
    ? config.locationCountry
    : options.locationCountry

  assert.equal(countryId, null)
  assert.deepEqual(
    buildWorkdayAppliedFacets(BASE_URL, countryId, config.countryFacetParameter),
    {
      locations: [
        'd9b1a3a6e54d1008421b5a4934ad0000',
        'f3ca14c95ae81010b95985e62beb0000',
      ],
    },
  )
})

test('run delegates to the Workday engine with the Alphawave company identity', async () => {
  const calls = []
  const jobs = await run({
    workdayRunner: async (options) => {
      calls.push(options)
      return [{ title: 'Senior Engineer' }]
    },
  })

  assert.deepEqual(jobs, [{ title: 'Senior Engineer' }])
  assert.deepEqual(calls, [buildScraperOptions()])
})
