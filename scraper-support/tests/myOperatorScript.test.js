import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at MyOperator | Build, Scale, and Lead With Ownership</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <p class="current-openings-heading">Channel Partner Sales Manager</p>
      <p class="current-openings-heading">Performance Marketing Executive</p>
      <p class="current-openings-heading">Talent Acquisition Specialist</p>
      <a href="https://careers.myoperator.com/jobs/Careers">View All Openings</a>
    </main>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs @ MyOperator</title>
  </head>
  <body>
    <input id="pageJson" />
    <input id="moduleMeta" />
    <input id="jobs" />
    <script>
      var page_id = '163599000003109531', portalPageJson, moduleMeta, jobs, meta, Crm;
    </script>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'Senior Site Reliability Engineer',
      City: 'Noida',
      Country: 'India',
      Job_Description: 'Build reliable platform infrastructure for Business AI Operator workloads.',
      Work_Experience: '3 To 5 Years',
      Job_Type: 'Full time',
      Date_Opened: '30/04/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      id: '163599000021255085',
    },
    {
      Posting_Title: 'Business Consultant',
      City: 'Noida',
      Country: 'India',
      Job_Description: 'Own the end-to-end sales cycle for inbound demand.',
      Work_Experience: '0 To 2 Years',
      Job_Type: 'Full time',
      Date_Opened: '29/01/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      id: '163599000020939005',
    },
    {
      Posting_Title: 'Revenue Director',
      City: 'Austin',
      Country: 'United States',
      Job_Description: 'Non-India role.',
      Work_Experience: '7 To 10 Years',
      Job_Type: 'Full time',
      Date_Opened: '15/07/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/999999999/Revenue-Director?source=CareerSite',
      id: '999999999',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/myoperator/script.js')
  } catch {
    assert.fail('Expected MyOperator scraper module at ../../scraper/myoperator/script.js')
  }
}

test('MyOperator helpers stay pinned to the verified shell, portal, and public Zoho Recruit payload', async () => {
  const myoperator = await loadModule()

  assert.equal(myoperator.SOURCE, 'myoperator')
  assert.equal(myoperator.COMPANY, 'MyOperator')
  assert.equal(myoperator.CAREERS_URL, 'https://myoperator.com/careers')
  assert.equal(myoperator.PORTAL_URL, 'https://careers.myoperator.com/jobs/Careers')
  assert.equal(
    myoperator.JOBS_API_URL,
    'https://careers.myoperator.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(myoperator.VERIFIED_ON, '2026-07-17')
  assert.equal(myoperator.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(myoperator.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(myoperator.extractIndiaJobs(apiPayload), [
    {
      title: 'Senior Site Reliability Engineer',
      company: 'MyOperator',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: '163599000021255085',
      requisitionId: '163599000021255085',
      sourceUrl: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      applyUrl: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '3 To 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '30/04/2026',
      closingDate: null,
      jobDescription: 'Build reliable platform infrastructure for Business AI Operator workloads.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Business Consultant',
      company: 'MyOperator',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: '163599000020939005',
      requisitionId: '163599000020939005',
      sourceUrl: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      applyUrl: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '0 To 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '29/01/2026',
      closingDate: null,
      jobDescription: 'Own the end-to-end sales cycle for inbound demand.',
      remoteStatus: 'On-site',
    },
  ])
})

test('MyOperator run validates the first-party shell and returns India jobs from the public Zoho Recruit API', async () => {
  const myoperator = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await myoperator.createMyOperatorScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === myoperator.CAREERS_URL) return careersShellHtml
      if (url === myoperator.PORTAL_URL) return portalHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      assert.equal(url, myoperator.JOBS_API_URL)
      return apiPayload
    },
  })

  assert.deepEqual(requestedTexts, [
    myoperator.CAREERS_URL,
    myoperator.PORTAL_URL,
  ])
  assert.deepEqual(requestedJson, [myoperator.JOBS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'myoperator')
  assert.equal(jobs[0].companyCareerPage, 'https://myoperator.com/careers')
  assert.equal(jobs[0].companyDomain, 'myoperator.com')
  assert.equal(jobs[0].atsPlatform, 'zoho-recruit')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('MyOperator fails closed when the verified shell, portal, or jobs API contract changes', async () => {
  const myoperator = await loadModule()

  await assert.rejects(
    myoperator.createMyOperatorScraper().run({
      fetchText: async (url) => (url === myoperator.CAREERS_URL ? '<html><body><h1>Careers</h1></body></html>' : portalHtml),
      fetchJson: async () => apiPayload,
    }),
    /verified MyOperator careers shell/i,
  )

  await assert.rejects(
    myoperator.createMyOperatorScraper().run({
      fetchText: async (url) => (url === myoperator.CAREERS_URL ? careersShellHtml : '<html><body><h1>Jobs</h1></body></html>'),
      fetchJson: async () => apiPayload,
    }),
    /verified MyOperator portal/i,
  )

  await assert.rejects(
    myoperator.createMyOperatorScraper().run({
      fetchText: async (url) => (url === myoperator.CAREERS_URL ? careersShellHtml : portalHtml),
      fetchJson: async () => ({ code: 'error', data: [] }),
    }),
    /verified MyOperator jobs api/i,
  )
})
