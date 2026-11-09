import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join STL Tech | Life at STL Tech | Careers</title>
  </head>
  <body>
    <main>
      <h2>WORLD OF OPPORTUNITIES</h2>
      <h3>Join us</h3>
      <p>Apply for your next job here</p>
      <a href="https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&#038;source=CAREERSITE#list">Apply</a>
      <footer>© 2026 STL Tech. All rights reserved.</footer>
    </main>
  </body>
</html>
`

const linkedJobsPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>STL and STL Digital Careers | Latest jobs at STL and STL Digital - Ripplehire.com</title>
  </head>
  <body>
    <input id="token" value="v0cOTxD3fgZqIF393gqj" />
    <input id="source" value="CAREERSITE" />
    <div>Latest job openings</div>
  </body>
</html>
`

const listingXml = `
<JobPageVO>
  <startJobIndex>0</startJobIndex>
  <maxJobSize>10</maxJobSize>
  <totalJobCount>1</totalJobCount>
  <jobVoList>
    <jobVoList>
      <jobSeq>888717</jobSeq>
      <jobTitle>Engineering Manager</jobTitle>
      <jobCode>IND/01/SDTL//19244</jobCode>
      <locations>Ahmedabad</locations>
      <jobId>888717</jobId>
      <jobReqExp>10+ years</jobReqExp>
      <jobPostingDate>2026-08-21</jobPostingDate>
    </jobVoList>
  </jobVoList>
</JobPageVO>
`

const detailXml = `
<jobVO>
  <jobSeq>888717</jobSeq>
  <jobTitle>Engineering Manager</jobTitle>
  <jobId>888717</jobId>
  <locations>Ahmedabad</locations>
  <jobReqExp>10+ years</jobReqExp>
  <jobTypeCustom3>Full Time</jobTypeCustom3>
  <jobDesc><![CDATA[<ul><li>Engineering leadership</li><li>Stakeholder management</li></ul>]]></jobDesc>
  <publishDetails><CAREER_SITE>2026-08-21</CAREER_SITE></publishDetails>
</jobVO>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Sterlite Technologies scraper module at ./script.js')
  }
}

test('Sterlite Technologies recognizes the refreshed STL life page and RippleHire board contract', async () => {
  const sterlite = await loadModule()

  assert.equal(sterlite.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(sterlite.hasLinkedJobsPortalSignal(linkedJobsPortalHtml), true)
  assert.equal(sterlite.hasRippleHireSearchResultsSignal(listingXml), true)
  assert.deepEqual(sterlite.extractSearchSummary(listingXml), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 1,
  })
  assert.deepEqual(sterlite.extractSearchResults(listingXml), [
    {
      title: 'Engineering Manager',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      jobId: '888717',
      requisitionId: '888717',
      sourceUrl: `${sterlite.JOB_BOARD_URL}#detail/job/888717`,
      applyUrl: `${sterlite.JOB_BOARD_URL}#apply/job/888717`,
      experienceRequired: '10+ years',
      postingDate: '2026-08-21',
      department: null,
      jobCode: 'IND/01/SDTL//19244',
    },
  ])
})

test('Sterlite Technologies run uses the refreshed careers handoff and public RippleHire XML to return India jobs', async () => {
  const sterlite = await loadModule()
  const requests = []

  const jobs = await sterlite.createSterliteTechnologiesScraper({
    fetchText: async (url, options = {}) => {
      requests.push([url, options.method || 'GET'])
      if (url === sterlite.CAREERS_URL) return careersHtml
      if (url === sterlite.JOBS_API_URL) return listingXml
      if (String(url).includes('/candidate/candidatejobdetail?')) return detailXml
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requests, [
    [sterlite.CAREERS_URL, 'GET'],
    [sterlite.JOBS_API_URL, 'POST'],
    [`${sterlite.PORTAL_ORIGIN}${sterlite.DETAIL_PATH}?token=${sterlite.TOKEN}&source=${sterlite.PORTAL_SOURCE}&lang=en&jobSeq=888717`, 'GET'],
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Engineering Manager')
  assert.equal(jobs[0].location, 'Ahmedabad, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.deepEqual(jobs[0].requiredSkills, ['Engineering leadership', 'Stakeholder management'])
})
