import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Target and Guidewire local Workday configs use the verified live request shapes for their public jobs APIs', () => {
  const targetConfig = loadConfig(path.join(testsDir, '../../scraper/target.workday'))
  const guidewireConfig = loadConfig(path.join(testsDir, '../../scraper/guidewire.workday'))

  assert.equal(targetConfig.listingStrategy, 'jobs-api')
  assert.equal(
    targetConfig.jobsApiUrl,
    'https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/jobs',
  )
  assert.equal(targetConfig.detailUrlBase, 'https://target.wd5.myworkdayjobs.com/en-US/targetcareers')
  assert.equal(targetConfig.locationCountry, null)
  assert.equal(targetConfig.searchText, 'India')
  assert.match(targetConfig.locationPattern, /india|bangalore|bengaluru|pune|hyderabad|mumbai|gurgaon|gurugram/i)

  assert.equal(guidewireConfig.listingStrategy, 'jobs-api')
  assert.equal(
    guidewireConfig.jobsApiUrl,
    'https://wd5.myworkdaysite.com/wday/cxs/guidewire/external/jobs',
  )
  assert.equal(guidewireConfig.detailUrlBase, 'https://wd5.myworkdaysite.com/recruiting/guidewire/external')
  assert.equal(guidewireConfig.countryFacetParameter, 'locationCountry')
})
