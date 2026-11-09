import assert from 'node:assert/strict'
import test from 'node:test'

const loadYubiModule = async () => {
  try {
    return await import('../../scraper/yubi/script.js')
  } catch {
    assert.fail('Expected Yubi scraper module at ../../scraper/yubi/script.js')
  }
}

const portalHtml = `
  <html>
    <head>
      <title>Jobs at Yubi</title>
      <meta property="og:url" content="https://go-yubi.zohorecruit.in/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{&quot;detail&quot;:{&quot;meta&quot;:{&quot;title&quot;:&quot;Jobs at Yubi&quot;}}}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">
      <a href="https://www.go-yubi.com/careers/">Careers</a>
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Company: 'Yubi',
      Posting_Title: 'L1  Support Engineer',
      Job_Opening_Name: 'L1  Support Engineer',
      Job_Type: 'Full time',
      Work_Experience: '2-10 years',
      Industry: 'Financial Services',
      Job_Description:
        'Yubi, formerly known as CredAvenue, is re-defining global debt markets.',
      State: 'Tamil Nadu',
      Country: 'India',
      City: 'Chennai',
      Date_Opened: '10/08/2024',
      Currency: 'INR',
      Publish: true,
      Is_Locked: false,
      Keep_on_Career_Site: false,
      id: '66789000020355749',
      $url: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000020355749/L1-Support-Engineer?source=CareerSite',
    },
    {
      Company: 'Accumn',
      Posting_Title: 'Data Scientist -1',
      Job_Opening_Name: 'Data Scientist -1',
      Job_Type: 'Full time',
      Work_Experience: '1-3 years',
      Industry: 'Financial Services',
      Job_Description: 'Shared group portal job that must not leak into Yubi output.',
      State: 'Tamil Nadu',
      Country: 'India',
      City: 'Chennai',
      Date_Opened: '12/15/2025',
      Currency: 'INR',
      Publish: true,
      Is_Locked: false,
      Keep_on_Career_Site: false,
      id: '66789000025352269',
      $url: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000025352269/Data-Scientist--1?source=CareerSite',
    },
    {
      Company: 'Yubi',
      Posting_Title: 'AVP - Corporate Loans - Gurugram',
      Job_Opening_Name: 'AVP - Corporate Loans - Gurugram',
      Job_Type: 'Full time',
      Work_Experience: '7-10 years',
      Industry: 'Financial Services',
      Job_Description: 'Locked job that should be excluded.',
      State: 'Haryana',
      Country: 'India',
      City: 'Gurgaon',
      Date_Opened: '03/05/2026',
      Currency: 'INR',
      Publish: true,
      Is_Locked: true,
      Keep_on_Career_Site: false,
      id: '66789000038033970',
      $url: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000038033970/AVP---Corporate-Loans---Gurugram?source=CareerSite',
    },
    {
      Company: 'Yubi',
      Posting_Title: 'Tech Recruiter',
      Job_Opening_Name: 'Tech Recruiter',
      Job_Type: 'Full time',
      Work_Experience: '3-6 years',
      Industry: 'Financial Services',
      Job_Description: 'Unpublished job that should be excluded.',
      State: 'Karnataka',
      Country: 'India',
      City: 'Bangalore',
      Date_Opened: '05/01/2026',
      Currency: 'INR',
      Publish: false,
      Is_Locked: false,
      Keep_on_Career_Site: true,
      id: '66789000022666497',
      $url: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000022666497/Tech-Recruiter?source=CareerSite',
    },
    {
      Company: 'Yubi',
      Posting_Title: 'Sales Leader - Yubi - Egypt',
      Job_Opening_Name: 'Sales Leader - Yubi - Egypt',
      Job_Type: 'Full time',
      Work_Experience: '6-10 years',
      Industry: 'Financial Services',
      Job_Description: 'Non-India job that should be excluded.',
      State: null,
      Country: 'Egypt',
      City: 'Cairo',
      Date_Opened: '06/10/2026',
      Currency: 'INR',
      Publish: true,
      Is_Locked: false,
      Keep_on_Career_Site: false,
      id: '66789000037359307',
      $url: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000037359307/Sales-Leader---Yubi---Egypt?source=CareerSite',
    },
  ],
}

test('Yubi constants stay pinned to the branded public Zoho careers surface', async () => {
  const yubi = await loadYubiModule()

  assert.equal(yubi.CAREERS_PORTAL_URL, 'https://go-yubi.zohorecruit.in/jobs/Careers')
  assert.equal(
    yubi.CAREERS_API_URL,
    'https://go-yubi.zohorecruit.in/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22State%22,%22Date_Opened%22,%22Work_Experience%22,%22Industry%22,%22Job_Description%22%5D',
  )
  assert.equal(yubi.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only exact Yubi India jobs that remain public and unlocked', async () => {
  const yubi = await loadYubiModule()
  const jobs = yubi.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'L1 Support Engineer',
      company: 'Yubi',
      department: 'Financial Services',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: '66789000020355749',
      requisitionId: '66789000020355749',
      sourceUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000020355749/L1-Support-Engineer?source=CareerSite',
      applyUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000020355749/L1-Support-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '2-10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2024-10-08',
      closingDate: null,
      jobDescription: 'Yubi, formerly known as CredAvenue, is re-defining global debt markets.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official Yubi portal before fetching and decorating exact Yubi India jobs', async () => {
  const yubi = await loadYubiModule()
  const requestedUrls = []

  const jobs = await yubi.createYubiScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-25T12:34:56.000Z',
  })

  assert.deepEqual(requestedUrls, [yubi.CAREERS_PORTAL_URL, yubi.CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'yubi')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-25T12:34:56.000Z')
})

test('run fails closed when the verified Yubi portal signal or exact Yubi India jobs disappear', async () => {
  const yubi = await loadYubiModule()

  await assert.rejects(
    yubi.createYubiScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /official yubi careers portal/i,
  )

  await assert.rejects(
    yubi.createYubiScraper().run({
      fetchText: async () => portalHtml,
      fetchJson: async () => ({ code: 'success', data: [apiPayload.data[1]] }),
    }),
    /trusted public yubi india jobs/i,
  )
})
