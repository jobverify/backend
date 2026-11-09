import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>AI Cloud Solutions | Cambridge Technology Inc.</title>
  </head>
  <body>
    <h1>Leap to The Future with AI at Your Core</h1>
    <p>Cambridge Technology</p>
    <a href="/careers/">Careers</a>
  </body>
</html>
`

const careersLandingHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Cambridge Technology Inc.</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Come, Be a Part of the Future of Technology</p>
    <p>Students/ Internships</p>
    <p>Freshers/ Graduates</p>
    <p>Experienced Professionals INDIA</p>
    <a href="https://cambridgetechnology.freshteam.com/jobs">Open Positions</a>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html>
  <body>
    <h1>Careers</h1>
    <p>Open Positions</p>
    <ul>
      <li data-portal-role="experienced">
        <h5>Engineering</h5>
        <a href="/jobs/abc123/software-engineer" data-portal-location="Bengaluru" data-portal-job-type="2">
          <div class="job-title">Software Engineer</div>
          <div class="job-desc">Build cloud systems</div>
          <div class="location-info">Bengaluru<br/>Full Time</div>
        </a>
      </li>
    </ul>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Software Engineer</h1>
    <div class="stick-hide-in-mobile">Bengaluru<div></div></div>
    <div class="job-details-content">
      <p>Work Type: Full Time</p>
      <p>3 years of experience building enterprise systems.</p>
    </div>
  </body>
</html>
`

test('Cambridge Technology recognizes the current homepage, careers landing, and Freshteam handoff chain', async () => {
  const cambridge = await loadModule()

  assert.equal(cambridge.OFFICIAL_HOMEPAGE_URL, 'https://www.ctepl.com/')
  assert.equal(cambridge.CAREERS_LANDING_URL, 'https://www.ctepl.com/careers/')
  assert.equal(cambridge.LISTING_URL, 'https://cambridgetechnology.freshteam.com/jobs')
  assert.equal(cambridge.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cambridge.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(
    cambridge.extractFreshteamJobsUrl(careersLandingHtml),
    'https://cambridgetechnology.freshteam.com/jobs',
  )
})

test('Cambridge Technology follows the first-party careers landing and extracts India jobs from Freshteam', async () => {
  const cambridge = await loadModule()

  const jobs = await cambridge.createCambridgeTechnologyEnterprisesScraper().run({
    fetchText: async (url) => {
      if (url === cambridge.OFFICIAL_HOMEPAGE_URL) return homepageHtml
      if (url === cambridge.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === 'https://cambridgetechnology.freshteam.com/jobs') return listingHtml
      if (url === 'https://cambridgetechnology.freshteam.com/jobs/abc123/software-engineer') {
        return detailHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-15T09:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].sourceUrl, 'https://cambridgetechnology.freshteam.com/jobs/abc123/software-engineer')
})
