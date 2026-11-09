import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers Learning - Bharat Gateway to the next 500 million</title>
  </head>
  <body class="page-template-careers-template">
    <section class="padded--wrapper" id="job--listing">
      <div class="container--responsive">
        <h3 class="section-title-dashed margin--b30">Current job openings</h3>
        <p><strong>If you want to work on meaningful challenges, contribute to Bharat's digital transformation and grow with a purpose-led organisation, PayNearby is the place for you.</strong></p>
      </div>
      <div class="container--responsive">
        <a href="https://www.linkedin.com/company/paynearby/" class="btn green green">Open Position</a>
      </div>
      <!--
      <div class="job-listing-categories align-left">
        <a href="https://paynearby.in/careers-learning/?job-category=business" class="job-category">Business <span class="category">(1)</span></a>
      </div>
      <div class="job-listing">
        <div class="job-preview">
          <div class="job-cta">
            <a class="apply-btn" href="https://jobs.lever.co/paynearby/business-partner">Apply</a>
          </div>
        </div>
      </div>
      -->
    </section>
  </body>
</html>
`

const OFFICIAL_CAREERS_WITH_VISIBLE_JOB_HTML = OFFICIAL_CAREERS_HTML.replace(
  '<!--\n      <div class="job-listing-categories align-left">',
  '<div class="job-listing-categories align-left">',
).replace(
  '      </div>\n      -->',
  '      </div>',
)

const loadPayNearbyModule = async () => {
  try {
    return await import('../../scraper/paynearby/script.js')
  } catch {
    assert.fail('Expected PayNearby scraper module at ../../scraper/paynearby/script.js')
  }
}

test('PayNearby helpers pin the official careers page, LinkedIn company handoff, and hidden old jobs markup', async () => {
  const payNearby = await loadPayNearbyModule()

  assert.equal(payNearby.SOURCE, 'paynearby')
  assert.equal(payNearby.COMPANY, 'PayNearby')
  assert.equal(payNearby.HOMEPAGE_URL, 'https://paynearby.in/')
  assert.equal(payNearby.CAREERS_URL, 'https://paynearby.in/careers-learning/')
  assert.equal(payNearby.LINKEDIN_COMPANY_URL, 'https://www.linkedin.com/company/paynearby/')
  assert.equal(payNearby.VERIFIED_ON, '2026-07-17')
  assert.equal(payNearby.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    payNearby.extractLinkedInCompanyUrl(OFFICIAL_CAREERS_HTML),
    'https://www.linkedin.com/company/paynearby/',
  )
  assert.equal(payNearby.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_HTML), false)
  assert.equal(payNearby.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_WITH_VISIBLE_JOB_HTML), true)
})

test('PayNearby returns [] only while the official careers page still exposes a LinkedIn company handoff without visible public job cards', async () => {
  const payNearby = await loadPayNearbyModule()
  const requests = []

  const jobs = await payNearby.createPayNearbyScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === payNearby.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      throw new Error(`Unexpected PayNearby URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [payNearby.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('PayNearby fails closed when the official careers page changes materially or starts exposing a trustworthy public jobs contract', async () => {
  const payNearby = await loadPayNearbyModule()

  await assert.rejects(
    payNearby.createPayNearbyScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    payNearby.createPayNearbyScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_WITH_VISIBLE_JOB_HTML,
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    payNearby.createPayNearbyScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_HTML.replace(
        'https://www.linkedin.com/company/paynearby/',
        'https://jobs.lever.co/paynearby',
      ),
    }),
    /linkedin company handoff/i,
  )
})
