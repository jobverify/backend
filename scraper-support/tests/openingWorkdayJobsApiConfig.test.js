import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('Workday sources use each tenant verified India scope', () => {
  const abbConfig = loadConfig(path.join(testsDir, '../../scraper/abb.workday'))
  const airbusConfig = loadConfig(path.join(testsDir, '../../scraper/airbus.workday'))
  const allstateConfig = loadConfig(path.join(testsDir, '../../scraper/allstate.workday'))
  const philipsConfig = loadConfig(path.join(testsDir, '../../scraper/philips.workday'))
  const quantiphiConfig = loadConfig(path.join(testsDir, '../../scraper/quantiphi.workday'))

  assert.equal(abbConfig.listingStrategy, 'jobs-api')
  assert.equal(
    abbConfig.jobsApiUrl,
    'https://abb.wd3.myworkdayjobs.com/wday/cxs/abb/External_Career_Page/jobs',
  )
  assert.equal(abbConfig.detailUrlBase, 'https://abb.wd3.myworkdayjobs.com/External_Career_Page')
  assert.equal(abbConfig.countryFacetParameter, 'locationCountry')
  assert.match(abbConfig.locationPattern, /india|bangalore|bengaluru|hyderabad|pune|mumbai|vadodara|chennai|gurgaon|gurugram/i)

  assert.equal(airbusConfig.listingStrategy, 'jobs-api')
  assert.equal(
    airbusConfig.jobsApiUrl,
    'https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus/jobs',
  )
  assert.equal(airbusConfig.detailUrlBase, 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus')
  assert.equal(airbusConfig.countryFacetParameter, 'locationCountry')

  assert.equal(allstateConfig.listingStrategy, 'jobs-api')
  assert.equal(
    allstateConfig.jobsApiUrl,
    'https://allstate.wd5.myworkdayjobs.com/wday/cxs/allstate/allstate_careers/jobs',
  )
  assert.equal(allstateConfig.detailUrlBase, 'https://allstate.wd5.myworkdayjobs.com/allstate_careers')
  assert.equal(allstateConfig.locationCountry, null)
  assert.equal(allstateConfig.searchText, 'India')
  assert.match(allstateConfig.locationPattern, /india|pune|bangalore|bengaluru|gurgaon|gurugram|hyderabad/i)

  assert.equal(philipsConfig.listingStrategy, 'jobs-api')
  assert.equal(
    philipsConfig.jobsApiUrl,
    'https://philips.wd3.myworkdayjobs.com/wday/cxs/philips/jobs-and-careers/jobs',
  )
  assert.equal(philipsConfig.detailUrlBase, 'https://philips.wd3.myworkdayjobs.com/en-US/jobs-and-careers')
  assert.equal(philipsConfig.countryFacetParameter, 'locationHierarchy1')
  assert.equal(philipsConfig.locationCountry, '6e1b2a934716103c2adde1d57e7700ea')
  assert.equal(philipsConfig.searchText, undefined)
  assert.match(philipsConfig.locationPattern, /india|bangalore|bengaluru|hyderabad|pune|mumbai|gurgaon|gurugram|chennai|kolkata|noida/i)

  assert.equal(quantiphiConfig.listingStrategy, 'jobs-api')
  assert.equal(
    quantiphiConfig.jobsApiUrl,
    'https://quantiphi.wd1.myworkdayjobs.com/wday/cxs/quantiphi/Careers_at_Quantiphi/jobs',
  )
  assert.equal(quantiphiConfig.detailUrlBase, 'https://quantiphi.wd1.myworkdayjobs.com/en-US/Careers_at_Quantiphi')
  assert.equal(quantiphiConfig.locationCountry, null)
  assert.equal(quantiphiConfig.searchText, 'India')
  assert.match(quantiphiConfig.locationPattern, /india|bengaluru|bangalore|hyderabad|mumbai|pune|gurgaon|gurugram|noida|kolkata|chennai/i)
})
