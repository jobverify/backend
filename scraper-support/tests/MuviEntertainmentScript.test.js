import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async () => {
  try {
    return await import('../../scraper/muvientertainment/script.js')
  } catch {
    assert.fail('Expected Muvi Entertainment scraper module at ../../scraper/muvientertainment/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Muvi - Build your Career with us! View current job openings at our various offices</title>
  </head>
  <body>
    <h2><strong>Current Openings</strong></h2>
    <div class="sjb-listing">
      <div class="list-view">
        <div class="list-data">
          <div class="row">
            <div class="job-info">
              <h4>
                <a href="https://www.muvi.com/jobs/email-outreach-manager/">
                  <span class="job-title">Email Outreach Manager</span>
                </a>
              </h4>
            </div>
            <div class="job-location"><i class="fa fa-map-marker"></i> Bhubaneswar</div>
            <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 2 years ago</div>
          </div>
          <div class="job-description">
            <p>JD: Email &amp; Outreach Manager We are looking for email marketing specialists who can generate leads.</p>
            <p><a href="https://www.muvi.com/jobs/email-outreach-manager/" class="btn btn-primary">Read More</a></p>
          </div>
        </div>
        <div class="clearfix"></div>
        <div class="list-data">
          <div class="row">
            <div class="job-info">
              <h4>
                <a href="https://www.muvi.com/jobs/database-administrator/">
                  <span class="job-title">Database Administrator</span>
                </a>
              </h4>
            </div>
            <div class="job-location"><i class="fa fa-map-marker"></i> Bhubaneswar</div>
            <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 2 years ago</div>
          </div>
          <div class="job-description">
            <p>Mysql Database Administrator (Mysql, MongoDB and Elasticsearch): We are looking for an experienced administrator.</p>
            <p><a href="https://www.muvi.com/jobs/database-administrator/" class="btn btn-primary">Read More</a></p>
          </div>
        </div>
        <div class="clearfix"></div>
      </div>
    </div>
  </body>
</html>
`

test('Muvi Entertainment extracts normalized jobs from the verified first-party careers page', async () => {
  const muvi = await loadModule()

  assert.equal(muvi.SOURCE, 'muvientertainment')
  assert.equal(muvi.COMPANY, 'Muvi Entertainment')
  assert.equal(muvi.CAREERS_URL, 'https://www.muvi.com/career/')
  assert.equal(muvi.hasOfficialCareersSignal(careersHtml), true)

  const extractedJobs = muvi.extractJobCards(careersHtml)
  assert.equal(extractedJobs.length, 2)
  assert.deepEqual(extractedJobs[0], {
    title: 'Email Outreach Manager',
    company: 'Muvi Entertainment',
    department: null,
    location: 'Bhubaneswar',
    city: 'Bhubaneswar',
    country: 'India',
    jobId: 'muvientertainment-email-outreach-manager',
    requisitionId: 'email-outreach-manager',
    sourceUrl: 'https://www.muvi.com/jobs/email-outreach-manager/',
    applyUrl: 'https://www.muvi.com/jobs/email-outreach-manager/',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'JD: Email & Outreach Manager We are looking for email marketing specialists who can generate leads.',
  })
})

test('Muvi Entertainment run decorates verified jobs with shared metadata', async () => {
  const muvi = await loadModule()

  const jobs = await muvi.createMuviEntertainmentScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, muvi.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[1].title, 'Database Administrator')
  assert.equal(jobs[1].source, 'muvientertainment')
  assert.equal(jobs[1].companyDomain, 'muvi.com')
  assert.equal(jobs[1].atsPlatform, 'first-party-careers-pagination-plus-job-details')
  assert.equal(jobs[1].companyCareerPage, muvi.CAREERS_URL)
  assert.equal(jobs[1].link, 'https://www.muvi.com/jobs/database-administrator/')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Muvi Entertainment fails closed when the verified careers surface changes materially', async () => {
  const muvi = await loadModule()

  await assert.rejects(
    muvi.createMuviEntertainmentScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    muvi.createMuviEntertainmentScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title> Muvi - Build your Career with us! View current job openings at our various offices</title>
          </head>
          <body>
            <h2><strong>Current Openings</strong></h2>
          </body>
        </html>
      `,
    }),
    /verified current openings links/i,
  )
})
