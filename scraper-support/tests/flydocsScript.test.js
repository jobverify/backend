import assert from 'node:assert/strict'
import test from 'node:test'

const loadFlydocsModule = async () => {
  try {
    return await import('../../scraper/flydocs/script.js')
  } catch {
    assert.fail('Expected Flydocs scraper module at ../../scraper/flydocs/script.js')
  }
}

const officialPortalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Careers</title>
    </head>
    <body>
      <input id="pageJson" type="hidden" value="{}">
      <input id="moduleMeta" type="hidden" value="{}">
      <input id="jobs" type="hidden" value="[]">
      <script>
        var page_id = '61915000000214664';
        window.__flydocsPortal = {"company_name":"flydocs","list_url":"https://flydocs.zohorecruit.in/jobs/careers","page_name":"careers"};
      </script>
    </body>
  </html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      id: '61915000008622445',
      Posting_Title: 'Technical Records Manager',
      Department: 'Operations',
      City: 'Pune',
      State: 'Maharashtra',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '5 years',
      Date_Opened: '2026-07-03',
      Job_Description: 'Support airline customers across records and compliance workflows.',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000008622445/Technical-Records-Manager?source=flydocsWebsite',
      Publish: true,
      Locked: false,
      Remote_Job: false,
    },
    {
      id: '61915000010176003',
      Posting_Title: 'Customer Experience Tier 1',
      Department: 'Customer Experience',
      City: 'Bangalore',
      State: 'Karnataka',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: null,
      Date_Opened: null,
      Job_Description: 'Handle customer support operations for aviation software users.',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000010176003/Customer-Experience-Tier-1?source=flydocsWebsite',
      Publish: true,
      Locked: false,
      Remote_Job: false,
    },
    {
      id: '61915000010176004',
      Posting_Title: 'Legacy Role',
      Department: 'Operations',
      City: 'Remote',
      Country: 'India',
      Job_Type: 'Full time',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000010176004/Legacy-Role?source=flydocsWebsite',
      Publish: false,
      Locked: false,
    },
    {
      id: '61915000010176099',
      Posting_Title: 'Dubai Operations',
      Department: 'Operations',
      City: 'Dubai',
      Country: 'United Arab Emirates',
      Job_Type: 'Full time',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000010176099/Dubai-Operations?source=flydocsWebsite',
      Publish: true,
      Locked: false,
    },
  ],
}

test('Flydocs constants and official portal signal stay pinned to the verified public Zoho careers portal', async () => {
  const flydocs = await loadFlydocsModule()

  assert.equal(flydocs.CAREERS_URL, 'https://flydocs.aero/vacancies/')
  assert.equal(flydocs.CAREERS_PORTAL_URL, 'https://flydocs.zohorecruit.in/jobs/Careers?source=CareerSite')
  assert.equal(
    flydocs.CAREERS_API_URL,
    'https://flydocs.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(flydocs.COMPANY, 'flydocs')
  assert.equal(flydocs.SOURCE, 'flydocs')
  assert.equal(flydocs.hasOfficialPortalSignal(officialPortalHtml), true)
})

test('extractIndiaJobs keeps India roles from the verified Flydocs public jobs payload', async () => {
  const flydocs = await loadFlydocsModule()

  const jobs = flydocs.extractIndiaJobs(jobsPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Technical Records Manager',
      company: 'flydocs',
      department: 'Operations',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: '61915000008622445',
      requisitionId: '61915000008622445',
      sourceUrl: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000008622445/Technical-Records-Manager?source=flydocsWebsite',
      applyUrl: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000008622445/Technical-Records-Manager?source=flydocsWebsite',
      employmentType: 'Full-time',
      experienceRequired: '5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-03',
      nativePostingDate: '2026-07-03',
      nativePostingDateFormat: 'yyyy-MM-dd',
      closingDate: null,
      jobDescription: 'Support airline customers across records and compliance workflows.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Customer Experience Tier 1',
      company: 'flydocs',
      department: 'Customer Experience',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: '61915000010176003',
      requisitionId: '61915000010176003',
      sourceUrl: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000010176003/Customer-Experience-Tier-1?source=flydocsWebsite',
      applyUrl: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000010176003/Customer-Experience-Tier-1?source=flydocsWebsite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      nativePostingDate: null,
      nativePostingDateFormat: null,
      closingDate: null,
      jobDescription: 'Handle customer support operations for aviation software users.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official Flydocs portal, fetches the public jobs payload, and decorates shared runner fields', async () => {
  const flydocs = await loadFlydocsModule()
  const requestedUrls = []

  const jobs = await flydocs.createFlydocsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === flydocs.CAREERS_PORTAL_URL) return officialPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === flydocs.CAREERS_API_URL) {
        return jobsPayload
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://flydocs.zohorecruit.in/jobs/Careers?source=CareerSite',
    'https://flydocs.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'flydocs')
  assert.equal(
    jobs[0].link,
    'https://flydocs.zohorecruit.in/jobs/Careers/61915000008622445/Technical-Records-Manager?source=flydocsWebsite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
})

test('run fails closed when the Flydocs official portal signal disappears', async () => {
  const flydocs = await loadFlydocsModule()

  await assert.rejects(
    flydocs.createFlydocsScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Flydocs careers portal/i,
  )
})
