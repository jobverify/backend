import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const emailOnlyCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers - CIMCON Software</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h3>Come Work With Us!</h3>
    <p>
      CIMCON is an expert in end to end AI, EUC and Model Risk management. We build software that has helped
      hundreds of organizations around the world gain error-free EUCs and models and dramatically reduce their
      risks through automation.
    </p>
    <h3>Current Openings</h3>
    <p>To apply for a position, send us your CV at hr@cimcon.com. Please indicate your area of interest in the email subject line.</p>
    <h3>Quick Question? Get in Touch.</h3>
  </body>
</html>
`

const indiaOpeningHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers - CIMCON Software</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h3>Come Work With Us!</h3>
    <p>
      CIMCON is an expert in end to end AI, EUC and Model Risk management. We build software that has helped
      hundreds of organizations around the world gain error-free EUCs and models and dramatically reduce their
      risks through automation.
    </p>
    <h3>Current Openings</h3>
    <p><strong>Software Engineer</strong> (work in Ahmedabad, India)</p>
    <h3>Quick Question? Get in Touch.</h3>
  </body>
</html>
`

test('CIMCON recognizes the live email-only careers page as a verified empty surface', async () => {
  const cimcon = await loadModule()

  assert.equal(cimcon.hasOfficialCareersSignal(emailOnlyCareersHtml), true)
  assert.equal(cimcon.hasEmailOnlyOpeningsSignal(emailOnlyCareersHtml), true)
  assert.deepEqual(cimcon.extractCurrentOpenings(emailOnlyCareersHtml), [])

  const jobs = await cimcon.createCimconScraper().run({
    fetchText: async (url) => {
      assert.equal(url, cimcon.CAREERS_PAGE_URL)
      return emailOnlyCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('CIMCON still extracts explicit India openings when they reappear on the first-party careers page', async () => {
  const cimcon = await loadModule()

  const jobs = await cimcon.createCimconScraper().run({
    fetchText: async () => indiaOpeningHtml,
    now: () => '2026-08-15T12:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Ahmedabad, India')
  assert.equal(jobs[0].city, 'Ahmedabad')
  assert.equal(jobs[0].sourceUrl, cimcon.CAREERS_PAGE_URL)
  assert.equal(jobs[0].remoteStatus, 'On-site')
})
