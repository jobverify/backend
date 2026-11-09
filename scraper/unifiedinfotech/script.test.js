import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Maximize Your Career &amp; Job Opportunities</title>
  </head>
  <body>
    <a href="#current-openings">View Openings</a>
    <h2>Explore Open Positions at Unified Infotech</h2>
    <div>Remote/Hybrid</div>
    <div>Full Time</div>
    <h5>Digital Marketing Manager</h5>
    <p>Join Our Trailblazing Team as a Digital Marketing Leader to shape the Future at Unified.</p>
    <div>Exp (8 - 12 years)</div>
    <div>Kolkata / Pan India</div>
    <a href="https://www.unifiedinfotech.net/career/digital-marketing-manager/">read more</a>
    <div>Remote/Hybrid</div>
    <div>Full Time</div>
    <h5>Android Native Developer</h5>
    <p>We specialize in delivering cutting-edge solutions across web, cloud, and mobile platforms.</p>
    <div>Exp (5-8 Years)</div>
    <div>Kolkata / Pan India</div>
    <a href="https://www.unifiedinfotech.net/career/android-native-developer/">read more</a>
    <button>Load More</button>
    <div>No jobs are posted right now or no jobs matched your specific search criteria.</div>
    <h3>Apply For A Position</h3>
  </body>
</html>
`

test('Unified Infotech recognizes the current careers page shell and extracts the current text-based job cards', async () => {
  const unified = await loadModule()

  assert.equal(unified.hasOfficialCareersSignal(careersHtml), true)

  const jobs = unified.extractJobCards(careersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Digital Marketing Manager',
    remoteType: 'Remote/Hybrid',
    employmentType: 'Full Time',
    location: 'Kolkata / Pan India',
    sourceUrl: 'https://www.unifiedinfotech.net/career/digital-marketing-manager/',
    applyUrl: 'https://www.unifiedinfotech.net/career/digital-marketing-manager/',
    experienceRequired: '8 - 12 years',
    jobDescription:
      'Join Our Trailblazing Team as a Digital Marketing Leader to shape the Future at Unified.',
  })
})

test('Unified Infotech returns the current public opening cards from the first-party careers page', async () => {
  const unified = await loadModule()

  const jobs = await unified.run({
    fetchText: async (url) => {
      assert.equal(url, unified.CAREERS_URL)
      return careersHtml
    },
    now: () => '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Unified Infotech')
  assert.equal(jobs[0].city, 'Kolkata')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'unifiedinfotech')
  assert.equal(jobs[1].title, 'Android Native Developer')
})
