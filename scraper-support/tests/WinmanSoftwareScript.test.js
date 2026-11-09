import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers for Experience Candidates - Winman Software</title>
  </head>
  <body>
    <h1>Opportunities For Experienced Candidates</h1>
    <p>Build your career with Winman Software at Mangaluru.</p>
    <table id="experienced_table">
      <tr>
        <th>Designation and Job Profile</th>
        <th>Experience</th>
      </tr>
      <tr>
        <td>
          <h5>Senior Accountant</h5>
          <ul>
            <li>Knowledge of GST and TDS compliances</li>
          </ul>
        </td>
        <td>3 to 5 years</td>
      </tr>
      <tr>
        <td>
          <h5>Electrical Maintenance Supervisor</h5>
          <ul>
            <li>Maintain plant electrical systems and preventive checks</li>
          </ul>
        </td>
        <td>5 to 8 years</td>
      </tr>
      <tr>
        <td>
          <h5>Regional Sales Manager</h5>
          <ul>
            <li>Drive channel sales for overseas markets</li>
          </ul>
        </td>
        <td>7 to 10 years</td>
      </tr>
    </table>
    <a href="https://winman.in/jobs/resume.aspx">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/winmansoftware/script.js')
  } catch {
    assert.fail('Expected Winman Software scraper module at ../../scraper/winmansoftware/script.js')
  }
}

test('Winman Software helpers stay pinned to the verified first-party experienced-candidates table from Friday, July 17, 2026', async () => {
  const winman = await loadModule()

  assert.equal(winman.SOURCE, 'winmansoftware')
  assert.equal(winman.COMPANY, 'Winman Software')
  assert.equal(winman.CAREERS_URL, 'https://www.winmansoftware.com/more/careers/')
  assert.equal(winman.APPLY_URL, 'https://winman.in/jobs/resume.aspx')
  assert.equal(winman.VERIFIED_ON, '2026-10-03')
  assert.equal(winman.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(winman.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(winman.extractJobs(verifiedCareersHtml), [
    {
      title: 'Senior Accountant',
      company: 'Winman Software',
      department: null,
      location: null,
      city: null,
      state: null,
      country: null,
      nativeGeographyQualified: false,
      rawNativeWorkplaceEvidence: null,
      jobId: 'senior-accountant',
      requisitionId: 'senior-accountant',
      sourceUrl: 'https://www.winmansoftware.com/more/careers/',
      applyUrl: 'https://winman.in/jobs/resume.aspx',
      employmentType: null,
      experienceRequired: '3 to 5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Knowledge of GST and TDS compliances',
      remoteStatus: 'On-site',
    },
    {
      title: 'Electrical Maintenance Supervisor',
      company: 'Winman Software',
      department: null,
      location: null,
      city: null,
      state: null,
      country: null,
      nativeGeographyQualified: false,
      rawNativeWorkplaceEvidence: null,
      jobId: 'electrical-maintenance-supervisor',
      requisitionId: 'electrical-maintenance-supervisor',
      sourceUrl: 'https://www.winmansoftware.com/more/careers/',
      applyUrl: 'https://winman.in/jobs/resume.aspx',
      employmentType: null,
      experienceRequired: '5 to 8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Maintain plant electrical systems and preventive checks',
      remoteStatus: 'On-site',
    },
    {
      title: 'Regional Sales Manager',
      company: 'Winman Software',
      department: null,
      location: null,
      city: null,
      state: null,
      country: null,
      nativeGeographyQualified: false,
      rawNativeWorkplaceEvidence: null,
      jobId: 'regional-sales-manager',
      requisitionId: 'regional-sales-manager',
      sourceUrl: 'https://www.winmansoftware.com/more/careers/',
      applyUrl: 'https://winman.in/jobs/resume.aspx',
      employmentType: null,
      experienceRequired: '7 to 10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Drive channel sales for overseas markets',
      remoteStatus: 'On-site',
    },
  ])
})

test('Winman Software run validates the verified first-party table before decorating extracted jobs', async () => {
  const winman = await loadModule()
  const requestedUrls = []

  const jobs = await winman.createWinmanSoftwareScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === winman.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected Winman URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [winman.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'winmansoftware')
  assert.equal(jobs[0].link, winman.APPLY_URL)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Winman Software run fails closed when the verified first-party careers table drifts', async () => {
  const winman = await loadModule()

  await assert.rejects(
    winman.createWinmanSoftwareScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Winman Software careers surface/i,
  )
})

test('Winman Software reads both current careers tables and validates linked fresher detail', async () => {
  const winman = await loadModule()
  const careers = `<title>Careers &#8211; Winman Software</title>
    <table id="freshers" class="job-table active"><tbody><tr><td><a href="https://www.winmansoftware.com/more/careers/software-engineer">Software Engineer</a></td></tr></tbody></table>
    <table id="experienced" class="job-table"><tbody><tr><td><h4>Senior Accountant</h4><ul><li>Oversee finalisation of accounts.</li></ul></td><td>2 years</td></tr></tbody></table>
    <a href="https://winman.in/jobs/resume.aspx">Apply Now</a>`
  const detail = `<h1 class="job-title">Software Engineer</h1><div>Winman Software India LLP</div><div>Mangalore</div>
    <ul class="job-summary"><li>Build and test software.</li></ul><p class="qualification">B.E.</p>
    <button onclick="window.open('https://winman.in/jobs/resume.aspx')">Apply Now</button>`
  assert.equal(winman.hasCurrentCareersSignal(careers), true)
  assert.deepEqual(Object.fromEntries(Object.entries(winman.extractCurrentListings(careers)).map(([key, rows]) => [key, rows.length])),
    { freshers: 1, experienced: 1 })
  const jobs = await winman.run({ fetchText: async url => url === winman.CAREERS_URL ? careers : detail })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].minimumQualification, 'B.E.')
  assert.equal(jobs[0].sourceUrl, 'https://www.winmansoftware.com/more/careers/software-engineer')
  assert.equal(jobs[1].title, 'Senior Accountant')
  assert.equal(jobs[1].experienceRequired, '2 years')
  assert.equal(jobs[1].sourceUrl, winman.CAREERS_URL)
  await assert.rejects(winman.run({ fetchText: async url => url === winman.CAREERS_URL ? careers : detail.replace('Software Engineer', 'Other job') }),
    /current job detail changed/i)
})
