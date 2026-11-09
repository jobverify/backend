import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Intel Workday company entry points at the prefiltered India route used by the live jobs API', () => {
  const companies = JSON.parse(
    readFileSync(path.join(testsDir, '../myworkday/companies.json'), 'utf8'),
  )
  const intel = companies.find((company) => company.name === 'intel')

  assert.ok(intel)
  assert.equal(
    intel.baseUrl,
    'https://intel.wd1.myworkdayjobs.com/External?locations=1e4a4eb3adf101f44070f976bf8184cf&locations=fabab36f05f51000ba74e9448dc20000',
  )
})

test('Intel Workday local config keeps the jobs API but does not override the country facet key', () => {
  const config = loadConfig(
    path.join(testsDir, '../../scraper/intel.workday'),
  )

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://intel.wd1.myworkdayjobs.com/External',
  )
  assert.equal(config.countryFacetParameter, undefined)
})
