import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_FORM_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers At Polymed</title>
  </head>
  <body>
    <h1>Careers At Polymed</h1>
    <p>Why Work at Polymed ?</p>
    <p>Send us your application on career@polymedicure.com or simply fill the application form below:</p>
    <label>Upload Resume (PDF only, max 30MB) *</label>
    <button type="submit">Submit Application</button>
  </body>
</html>
`

const CURRENT_CAREERS_FORM_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers At Polymed</title>
  </head>
  <body>
    <h1>Careers At Polymed</h1>
    <p>Why Work at Polymed ?</p>
    <p>Send us your application or simply fill the application form below:</p>
    <label>Upload Resume (PDF only, max 30MB) *</label>
    <input type="submit" value="Submit Application" />
  </body>
</html>
`

const STALE_JOB_OPENING_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Opening - Poly Medicure Limited</title>
  </head>
  <body>
    <h1>Job Opening</h1>
    <h4>Job Opening</h4>
    <h5>October 21, 2019 0 Comments Poly Medicure Ltd.</h5>
    <div>[vc_row][vc_column][vc_column_text]Career[/vc_column_text][/vc_column]</div>
    <h2>Career</h2>
    <h2>Product Quick Finder</h2>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Polymed Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <div class="job-card">
      <h2>Quality Engineer</h2>
      <a href="/careers/quality-engineer">Apply Now</a>
    </div>
  </body>
</html>
`

const loadPolymedModule = async () => {
  try {
    return await import('../../scraper/polymed/script.js')
  } catch {
    assert.fail('Expected Polymed scraper module at ../../scraper/polymed/script.js')
  }
}

test('Polymed helpers pin the official careers form and stale job-opening page contract', async () => {
  const polymed = await loadPolymedModule()

  assert.equal(polymed.SOURCE, 'polymed')
  assert.equal(polymed.COMPANY_NAME, 'Polymed')
  assert.equal(polymed.HOMEPAGE_URL, 'https://www.polymedicure.com/')
  assert.equal(polymed.CAREERS_URL, 'https://www.polymedicure.com/careers/')
  assert.equal(polymed.JOB_OPENING_URL, 'https://www.polymedicure.com/job-opening/')
  assert.equal(polymed.OFFICIAL_CAREERS_EMAIL, null)
  assert.equal(polymed.VERIFIED_ON, '2026-08-07')
  assert.equal(polymed.hasOfficialCareersFormSignal(CAREERS_FORM_HTML), true)
  assert.equal(polymed.hasOfficialCareersFormSignal(CURRENT_CAREERS_FORM_HTML), true)
  assert.equal(polymed.extractOfficialCareersEmail(CAREERS_FORM_HTML), 'career@polymedicure.com')
  assert.equal(polymed.extractOfficialCareersEmail(CURRENT_CAREERS_FORM_HTML), null)
  assert.equal(polymed.hasStaleJobOpeningSignal(STALE_JOB_OPENING_HTML), true)
  assert.equal(polymed.hasPublicJobBoardSignals(CAREERS_FORM_HTML), false)
  assert.equal(polymed.hasPublicJobBoardSignals(PUBLIC_JOBS_HTML), true)
})

test('Polymed returns [] only while the careers page remains form-only and the job-opening page remains stale', async () => {
  const polymed = await loadPolymedModule()
  const requests = []

  const jobs = await polymed.createPolymedScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === polymed.CAREERS_URL) return CURRENT_CAREERS_FORM_HTML
      if (url === polymed.JOB_OPENING_URL) return STALE_JOB_OPENING_HTML
      throw new Error(`Unexpected Polymed URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    polymed.CAREERS_URL,
    polymed.JOB_OPENING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Polymed fails closed when the careers page or stale job-opening evidence changes materially', async () => {
  const polymed = await loadPolymedModule()

  await assert.rejects(
    polymed.createPolymedScraper().run({
      fetchText: async (url) => {
        if (url === polymed.CAREERS_URL) return PUBLIC_JOBS_HTML
        if (url === polymed.JOB_OPENING_URL) return STALE_JOB_OPENING_HTML
        throw new Error(`Unexpected Polymed URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    polymed.createPolymedScraper().run({
      fetchText: async (url) => {
        if (url === polymed.CAREERS_URL) {
          return CAREERS_FORM_HTML.replace('career@polymedicure.com', 'jobs@polymedicure.com')
        }
        if (url === polymed.JOB_OPENING_URL) return STALE_JOB_OPENING_HTML
        throw new Error(`Unexpected Polymed URL: ${url}`)
      },
    }),
    /careers email/i,
  )

  await assert.rejects(
    polymed.createPolymedScraper().run({
      fetchText: async (url) => {
        if (url === polymed.CAREERS_URL) return CURRENT_CAREERS_FORM_HTML
        if (url === polymed.JOB_OPENING_URL) return '<html><body><h1>Fresh openings</h1></body></html>'
        throw new Error(`Unexpected Polymed URL: ${url}`)
      },
    }),
    /job-opening page/i,
  )
})
