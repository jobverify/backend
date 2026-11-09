import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers at Invenio</h1>
    <h5>Where can I find the current open positions at Invenio?</h5>
    <p>We publish all our open positions on the Invenio website. To learn more about current job openings please visit https://jobs.jobvite.com/inveniolsi</p>
    <p>How do I apply if I am interested in a position?</p>
    <p>You can apply directly to Invenio by sending your resume to talent.hr@invenio-solutions.com.</p>
  </body>
</html>
`

const ZERO_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>LSI Consulting Careers</h1>
    <h2>Open Positions</h2>
    <p>There are currently no open jobs.</p>
    <p>If you don't see a role that fits your profile, then apply with our General Application.</p>
    <p>Powered by Jobvite</p>
  </body>
</html>
`

const PUBLIC_JOB_LISTINGS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>invenioLSI Careers</h1>
    <h2>Open Positions</h2>
    <table>
      <tr><th>Job listing</th><th>Job location</th></tr>
      <tr><td>SAP UI5 Consultant</td><td>India, India</td></tr>
      <tr><td>Angular Consultant</td><td>Hyderabad, India</td></tr>
    </table>
    <a href="https://jobs.jobvite.com/inveniolsi/job/oLF6vfwL">MuleSoft Consultant</a>
    <p>Powered by Jobvite</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/inveniobusinesssolutions/script.js')
  } catch {
    assert.fail('Expected Invenio Business Solutions scraper module at ../../scraper/inveniobusinesssolutions/script.js')
  }
}

test('Invenio Business Solutions helpers stay pinned to the verified careers FAQ and Jobvite zero-openings page', async () => {
  const invenio = await loadModule()

  assert.equal(invenio.SOURCE, 'inveniobusinesssolutions')
  assert.equal(invenio.COMPANY, 'Invenio Business Solutions')
  assert.equal(invenio.CAREERS_URL, 'https://invenio-solutions.com/careers')
  assert.equal(invenio.JOBS_BOARD_URL, 'https://jobs.jobvite.com/inveniolsi/jobs')
  assert.equal(invenio.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(invenio.hasJobviteZeroOpeningsSignal(ZERO_OPENINGS_HTML), true)
  assert.equal(invenio.hasPublicJobListingsSignal(PUBLIC_JOB_LISTINGS_HTML), true)
})

test('Invenio Business Solutions returns [] only while the verified Jobvite board shows no open jobs', async () => {
  const invenio = await loadModule()
  const requestedUrls = []

  const jobs = await invenio.createInvenioBusinessSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === invenio.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === invenio.JOBS_BOARD_URL) return ZERO_OPENINGS_HTML
      throw new Error(`Unexpected Invenio URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    invenio.CAREERS_URL,
    invenio.JOBS_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Invenio Business Solutions fails closed when the first-party FAQ drifts or the Jobvite board starts listing jobs again', async () => {
  const invenio = await loadModule()

  await assert.rejects(
    invenio.createInvenioBusinessSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Invenio Business Solutions careers page/i,
  )

  await assert.rejects(
    invenio.createInvenioBusinessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === invenio.CAREERS_URL) return VERIFIED_CAREERS_HTML
        return PUBLIC_JOB_LISTINGS_HTML
      },
    }),
    /public jobs again/i,
  )
})
