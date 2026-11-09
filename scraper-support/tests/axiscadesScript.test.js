import assert from 'node:assert/strict'
import test from 'node:test'

const loadAxiscadesModule = async () => {
  try {
    return await import('../../scraper/axiscades/script.js')
  } catch {
    assert.fail('Expected AXISCADES scraper module at ../../scraper/scraper/axiscades/script.js')
  }
}

const jobsHtml = `
<html>
  <body>
    <h1>Job Listings</h1>
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-6 mb-4 d-flex">
          <div class="jobcard d-flex w-100">
            <div class="jobcard-body w-100">
              <div class="me-3 d-flex align-items-center">10/11/2025</div>
              <h5 class="jobcard-title">System Test Engineer - Test</h5>
              <div class="d-flex flex-wrap align-items-center mb-2 justify-between">
                <div class="me-3 d-flex align-items-center">Bengaluru, Hyderabad</div>
                <div class="d-flex align-items-center">Full Time</div>
              </div>
              <div class="job-description-wrapper d-flex">
                <a target="_blank" class="job-description-button" href="https://axiscadespdfs.b-cdn.net/jobs/system-test-engineer.pdf" download>Download Job Description</a>
              </div>
              <div class="apply-now-wrapper d-flex mt-3">
                <a href="#" class="apply-now-button" data-popup-id="1975">Apply Now</a>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-4 col-md-6 mb-4 d-flex">
          <div class="jobcard d-flex w-100">
            <div class="jobcard-body w-100">
              <div class="me-3 d-flex align-items-center">10/11/2025</div>
              <h5 class="jobcard-title">System Test Engineer - Test</h5>
              <div class="d-flex flex-wrap align-items-center mb-2 justify-between">
                <div class="me-3 d-flex align-items-center">Bengaluru, Chennai, Hyderabad</div>
                <div class="d-flex align-items-center">Full Time</div>
              </div>
              <div class="job-description-wrapper d-flex">
                <a target="_blank" class="job-description-button" href="https://axiscadespdfs.b-cdn.net/jobs/system-test-engineer-2.pdf" download>Download Job Description</a>
              </div>
              <div class="apply-now-wrapper d-flex mt-3">
                <a href="#" class="apply-now-button" data-popup-id="1976">Apply Now</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractJobCards maps AXISCADES public jobs cards into shared scraper fields', async () => {
  const axiscades = await loadAxiscadesModule()
  const jobs = axiscades.extractJobCards(jobsHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'System Test Engineer - Test',
    company: 'AXISCADES',
    companyCareerPage: 'https://www.axiscades.com/jobs/',
    department: null,
    location: 'Bengaluru, Hyderabad',
    city: 'Bengaluru',
    country: 'India',
    atsPlatform: 'official-company-careers',
    jobId: '1975',
    requisitionId: 'system-test-engineer-test-bengaluru-hyderabad-2025-11-10',
    sourceUrl: 'https://axiscadespdfs.b-cdn.net/jobs/system-test-engineer.pdf',
    applyUrl: 'https://www.axiscades.com/jobs/',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-11-10',
    closingDate: null,
    jobDescription: null,
  })
})

test('run fetches the AXISCADES jobs page and decorates jobs', async () => {
  const axiscades = await loadAxiscadesModule()
  const requestedUrls = []
  const scraper = axiscades.createAxiscadesScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === axiscades.JOBS_PAGE_URL) return jobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [axiscades.JOBS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'axiscades')
  assert.equal(jobs[0].link, 'https://www.axiscades.com/jobs/')
  assert.equal(jobs[0].company, 'AXISCADES')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
