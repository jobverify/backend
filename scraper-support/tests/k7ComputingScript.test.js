import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createK7ComputingScraper,
  extractK7ComputingJobs,
  hasVerifiedEmptyCareersSignal,
  hasOfficialCareersSignal,
} from '../../scraper/k7computing/script.js'

const careersWithOpeningHtml = `
  <html>
    <head><title>Careers - K7 Security</title></head>
    <body>
      <h1>Careers at K7 Computing</h1>
      <h2>Current Openings</h2>
      <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-10540">
        <div class="awsm-job-item">
          <div class="awsm-list-left-col">
            <h2 class="awsm-job-post-title">
              <a href="https://careers.k7computing.com/index.php/jobs/sales-manager/">Sales Manager</a>
            </h2>
          </div>
          <div class="awsm-list-right-col">
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-type">
                <span class="awsm-job-specification-term">WFH</span>
              </div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location">
                <span class="awsm-job-specification-term">Abu Dhabi</span>
              </div>
            </div>
            <div class="awsm-job-more-container">
              <a class="awsm-job-more" href="https://careers.k7computing.com/index.php/jobs/sales-manager/">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const emptyCareersHtml = `
  <html>
    <head><title>Careers &#8211; K7 Security</title></head>
    <body>
      <h1>Careers at K7 Computing</h1>
      <h2>Current Openings</h2>
      <p>We currently have no job openings</p>
    </body>
  </html>
`

test('K7 Computing recognizes the verified first-party careers surface and can still parse legacy openings', () => {
  assert.equal(SOURCE, 'k7computing')
  assert.equal(COMPANY, 'K7 Computing')
  assert.equal(CAREERS_URL, 'https://careers.k7computing.com/')
  assert.equal(hasOfficialCareersSignal(careersWithOpeningHtml), true)
  assert.deepEqual(extractK7ComputingJobs(careersWithOpeningHtml), [
    {
      title: 'Sales Manager',
      location: 'Abu Dhabi',
      country: 'United Arab Emirates',
      sourceUrl: 'https://careers.k7computing.com/index.php/jobs/sales-manager/',
      applyUrl: 'https://careers.k7computing.com/index.php/jobs/sales-manager/',
      jobType: null,
    },
  ])
})

test('K7 Computing recognizes the verified empty careers state and returns []', async () => {
  assert.equal(hasOfficialCareersSignal(emptyCareersHtml), true)
  assert.equal(hasVerifiedEmptyCareersSignal(emptyCareersHtml), true)
  assert.deepEqual(extractK7ComputingJobs(emptyCareersHtml), [])

  const requestedUrls = []
  const jobs = await createK7ComputingScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return emptyCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('K7 Computing fails closed when the trusted careers surface changes', async () => {
  await assert.rejects(
    createK7ComputingScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified K7 Computing careers surface/i,
  )
})
