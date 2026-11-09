import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const scraperDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/cloudlending.workday',
)

const loadModule = async () => {
  try {
    return await import('../../scraper/cloudlending.workday/script.js')
  } catch {
    assert.fail('Expected Cloud Lending scraper module at ../../scraper/cloudlending.workday/script.js')
  }
}

test('Cloud Lending script pins the verified Q2 careers and Workday surfaces', async () => {
  const cloudLending = await loadModule()

  assert.equal(cloudLending.SOURCE, 'cloudlending')
  assert.equal(cloudLending.COMPANY_NAME, 'Cloud Lending')
  assert.equal(
    cloudLending.CAREER_PAGE_URL,
    'https://www.q2.com/company/why-work-at-q2/careers',
  )
  assert.equal(
    cloudLending.BASE_URL,
    'https://q2ebanking.wd5.myworkdayjobs.com/Q2',
  )
  assert.equal(
    cloudLending.INDIA_LOCATION_COUNTRY,
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(cloudLending.VERIFIED_ON, '2026-07-14')
  assert.match(cloudLending.VERIFIED_SURFACE_SUMMARY, /official careers page links to a public Workday board/i)
  assert.deepEqual(cloudLending.LEGACY_REDIRECT_CHAIN, [
    'https://cloudlendinginc.com/',
    'https://www.q2.com/fintech/lending',
    'https://www.q2.com/products/digital-banking/altfi-lending',
    'https://www.q2.com/',
  ])
})

test('Cloud Lending config post-filters Workday results to India locations', () => {
  const config = loadConfig(scraperDir)

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.match(
    config.locationPattern,
    /india\|bengaluru\|bangalore\|hyderabad\|pune\|mumbai/i,
  )
})

test('Cloud Lending delegates to the shared Workday engine with the verified India filter', async () => {
  const cloudLending = await loadModule()
  const calls = []

  const jobs = await cloudLending.run({
    workdayRunner: async (options) => {
      calls.push(options)
      return [{ title: 'Software Engineer' }]
    },
  })

  assert.deepEqual(jobs, [{ title: 'Software Engineer' }])
  assert.deepEqual(calls, [cloudLending.buildScraperOptions()])
})
