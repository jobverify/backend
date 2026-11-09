import assert from 'node:assert/strict'
import test from 'node:test'

const loadInfrabeatModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Infrabeat Technologies scraper module at ./script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at InfraBeat: Join Our Global Digital Transformation Team</title>
  </head>
  <body>
    <h1>Join our innovative team</h1>
    <h2>Open Positions</h2>
    <a href="#">Apply Now</a>

    <div class="accordion-item active">
      <div class="modal fade career-modal" id="exampleModal1">
        <div class="career-apply-modal">
          <p><strong>Job Location :</strong> Pune</p>
          <p><strong>SAP Experience : </strong>8+ years of experience in SAP development</p>
          <p><strong>Roles &amp; Responsibilities:</strong></p>
          <ul>
            <li>Lead discovery sessions.</li>
            <li>Own SAP MM delivery.</li>
          </ul>
        </div>
      </div>
      <div class="accordion-header">
        <div class="job-item">
          <h3 class="job_title">Lead SAP MM Consultant</h3>
          <div class="career-loc">
            <h6>Location</h6>
            <p>Pune</p>
          </div>
          <div class="career-exp">
            <h6>Experience</h6>
            <p>8 + Years</p>
          </div>
        </div>
      </div>
    </div>

    <div class="accordion-item active">
      <div class="modal fade career-modal" id="exampleModal2">
        <div class="career-apply-modal">
          <p><strong>Job Location :</strong> Pune</p>
          <p><strong>SAP Experience : </strong>4+ years of experience in SAP development</p>
          <p><strong>Roles &amp; Responsibilities:</strong></p>
          <ul>
            <li>Support SAP FICO delivery.</li>
          </ul>
        </div>
      </div>
      <div class="accordion-header">
        <div class="job-item">
          <h3 class="job_title">SAP FICO Senior Consultant</h3>
          <div class="career-loc">
            <h6>Location</h6>
            <p>Pune</p>
          </div>
          <div class="career-exp">
            <h6>Experience</h6>
            <p>4 + Years</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('Infrabeat Technologies validates the current careers page shell and inline jobs', async () => {
  const infrabeat = await loadInfrabeatModule()

  assert.equal(infrabeat.SOURCE, 'infrabeattechnologies')
  assert.equal(infrabeat.COMPANY, 'Infrabeat Technologies')
  assert.equal(infrabeat.CAREERS_URL, 'https://infrabeat.com/careers/')
  assert.equal(infrabeat.hasOfficialCareersSignal(careersHtml), true)

  const jobs = infrabeat.extractJobs(careersHtml)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Lead SAP MM Consultant')
  assert.equal(jobs[0].location, 'Pune, India')
  assert.equal(jobs[0].jobId, 'exampleModal1')
  assert.match(jobs[0].sourceUrl, /#exampleModal1$/)
  assert.match(jobs[0].jobDescription, /Lead discovery sessions/i)
})

test('Infrabeat Technologies returns inline jobs from the verified careers page', async () => {
  const infrabeat = await loadInfrabeatModule()
  const jobs = await infrabeat.createInfrabeatTechnologiesScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'infrabeattechnologies')
  assert.equal(jobs[0].companyCareerPage, 'https://infrabeat.com/careers/')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('Infrabeat Technologies falls back to a browser-backed loader when Node fetch times out', async () => {
  const infrabeat = await loadInfrabeatModule()
  const requestedPrimaryUrls = []
  const requestedBrowserUrls = []

  const jobs = await infrabeat.createInfrabeatTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      requestedBrowserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [infrabeat.CAREERS_URL])
  assert.deepEqual(requestedBrowserUrls, [infrabeat.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Lead SAP MM Consultant')
})
