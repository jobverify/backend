import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALL_JOBS_URL,
  BENGALURU_LOCATION_URL,
  COMPANY,
  LOCATIONS_OVERVIEW_URL,
  MUMBAI_LOCATION_URL,
  OFFICIAL_BRAND_NAME,
  SOURCE,
  createDynatraceScraper,
  hasAllJobsPageSignal,
  hasIndiaLocationCounts,
  hasLocationPageSignal,
  hasNoOpenRolesMessage,
  hasZeroOpenPositions,
} from './script.js'

const allJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Overview | Dynatrace Careers</title>
  </head>
  <body>
    <h1>All Dynatrace jobs</h1>
    <p>Dynatrace Careers</p>
    <p>No open roles right now</p>
    <p>0 open positions</p>
  </body>
</html>
`

const locationsOverviewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Location Overview | Dynatrace Careers</title>
  </head>
  <body>
    <h1>Our locations</h1>
    <p>India Bengaluru No current jobs</p>
    <p>India Mumbai 2 jobs</p>
  </body>
</html>
`

const bengaluruHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Bengaluru | Dynatrace Careers</title>
  </head>
  <body>
    <h1>Careers in Bengaluru</h1>
    <p>Explore all jobs</p>
    <p>Dynatrace India Software Operations Pvt. Ltd.</p>
    <p>1st floor, Table Space Towers, Bengaluru, Karnataka 560048, India</p>
  </body>
</html>
`

const mumbaiHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mumbai | Dynatrace Careers</title>
  </head>
  <body>
    <h1>Careers in Mumbai</h1>
    <p>Explore all jobs</p>
    <p>Dynatrace India Software Operations Pvt. Ltd.</p>
    <p>20th Floor, Mumbai, Maharashtra, 400051 India</p>
  </body>
</html>
`

test('Dynatrace current contradictory empty-state signals stay verified', () => {
  assert.equal(SOURCE, 'dynatrace')
  assert.equal(COMPANY, 'Dynatrace')
  assert.equal(OFFICIAL_BRAND_NAME, 'Dynatrace')
  assert.equal(ALL_JOBS_URL, 'https://www.dynatrace.com/careers/jobs/')
  assert.equal(LOCATIONS_OVERVIEW_URL, 'https://www.dynatrace.com/careers/locations/')
  assert.equal(BENGALURU_LOCATION_URL, 'https://www.dynatrace.com/careers/locations/bengaluru/')
  assert.equal(MUMBAI_LOCATION_URL, 'https://www.dynatrace.com/careers/locations/mumbai/')
  assert.equal(hasAllJobsPageSignal(allJobsHtml), true)
  assert.equal(hasZeroOpenPositions(allJobsHtml), true)
  assert.equal(hasIndiaLocationCounts(locationsOverviewHtml), true)
  assert.equal(hasLocationPageSignal(bengaluruHtml, 'Bengaluru'), true)
  assert.equal(hasLocationPageSignal(mumbaiHtml, 'Mumbai'), true)
  assert.equal(hasNoOpenRolesMessage(bengaluruHtml), true)
  assert.equal(hasNoOpenRolesMessage(mumbaiHtml), true)
})

test('Dynatrace scraper returns no jobs while the verified India surfaces remain contradictory-empty', async () => {
  const jobs = await createDynatraceScraper().run({
    fetchText: async (url) => {
      if (url === ALL_JOBS_URL) return allJobsHtml
      if (url === LOCATIONS_OVERVIEW_URL) return locationsOverviewHtml
      if (url === BENGALURU_LOCATION_URL) return bengaluruHtml
      if (url === MUMBAI_LOCATION_URL) return mumbaiHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
