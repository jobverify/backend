import assert from 'node:assert/strict'
import test from 'node:test'

const JOIN_US_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Sattva | Meaningful careers in sustainability & impact</title>
  </head>
  <body>
    <main>
      <h1>We are driven by impact and powered by knowledge.</h1>
      <h2>Life at Sattva</h2>
      <h2>Careers</h2>
      <p>Learn about our new opportunities and apply for positions online.</p>
      <a href="https://www.sattva.co.in/join-us/careers/">Know more</a>
      <p>For career and job opportunities, write to: careers@sattva.co.in</p>
    </main>
  </body>
</html>
`



const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Sattva Consulting</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Interested in being one of us?</p>
      <a href="https://sattva-talent.freshteam.com/jobs">SEE ALL JOBS</a>
      <p>For career and job opportunities, write to: careers@sattva.co.in</p>
    </main>
  </body>
</html>
`

const BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Careers</h4>
    <h3>Open Positions</h3>
    <div class="job-list">
      <a href="/jobs/NL9eULd4lxHD/analyst-data-science-spatial-analytics" class="heading" data-portal-location="New Delhi, India">
        <div class="row">
          <div class="job-list-info">
            <div class="job-title">Analyst - Data Science & Spatial Analytics</div>
            <div class="job-desc text">Role: Analyst - Data Science & Spatial Analytics Employment type: Contract (1 Year) Location: Delhi / Gurgaon / Bangalore</div>
          </div>
          <div class="job-location">
            <div class="location-info">
              New Delhi, Delhi
              <br/>
              Contract
            </div>
          </div>
        </div>
      </a>
      <a href="/jobs/VyhBa3Uwin7B/intern-corporate-advisory" class="heading" data-portal-location="Mumbai, India">
        <div class="row">
          <div class="job-list-info">
            <div class="job-title">Intern - Corporate Advisory</div>
            <div class="job-desc text">Position: Intern - Corporate Advisory Employment type: Internship Location: Mumbai</div>
          </div>
          <div class="job-location">
            <div class="location-info">
              Mumbai, Maharashtra
              <br/>
              Internship
            </div>
          </div>
        </div>
      </a>
      <a href="/jobs/ldn000000001/growth-manager-emea" class="heading" data-portal-location="London, United Kingdom">
        <div class="row">
          <div class="job-list-info">
            <div class="job-title">Growth Manager - EMEA</div>
            <div class="job-desc text">Employment type: Full Time Location: London</div>
          </div>
          <div class="job-location">
            <div class="location-info">
              London, England
              <br/>
              Full Time
            </div>
          </div>
        </div>
      </a>
    </div>
  </body>
</html>
`





const loadModule = async () => {
  try {
    return await import('../../scraper/sattvamedia/script.js')
  } catch {
    assert.fail('Expected Sattva Media scraper module at ../../scraper/sattvamedia/script.js')
  }
}

test('Historical sattvaMedia parser fixtures remain pure helpers, separate from current acquisition', async () => {
  const sattvaMedia = await loadModule()

  assert.equal(sattvaMedia.SOURCE, 'sattvamedia')
  assert.equal(sattvaMedia.COMPANY_NAME, 'Sattva Media')
  assert.equal(sattvaMedia.OFFICIAL_BRAND_NAME, 'Sattva Consulting')
  assert.equal(sattvaMedia.LEGAL_ENTITY_NAME, 'Sattva Media and Consulting Private Limited')
  assert.equal(sattvaMedia.JOIN_US_URL, 'https://www.sattva.co.in/join-us/')
  assert.equal(sattvaMedia.CAREERS_URL, 'https://www.sattva.co.in/join-us/careers/')
  assert.equal(sattvaMedia.LISTING_URL, 'https://careers.kula.ai/sattva')
  assert.equal(
    sattvaMedia.buildDetailUrl('NL9eULd4lxHD', 'analyst-data-science-spatial-analytics'),
    'https://sattva-talent.freshteam.com/jobs/NL9eULd4lxHD/analyst-data-science-spatial-analytics',
  )
  assert.equal(sattvaMedia.hasOfficialJoinUsLandingSignal(JOIN_US_HTML), true)
  assert.equal(sattvaMedia.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(sattvaMedia.extractFreshteamJobsUrl(CAREERS_HTML), 'https://sattva-talent.freshteam.com/jobs')
  assert.equal(sattvaMedia.hasOfficialJobsBoardSignal(BOARD_HTML), true)
})
