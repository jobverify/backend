import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_PAGE_URL,
  CAREERS_PORTAL_URL,
  COMPANY,
  SOURCE,
  createProlificsCorporationLtdScraper,
  extractIndiaJobs,
  hasOfficialCareersPageSignal,
  hasOfficialPortalSignal,
} from '../../scraper/prolificscorporationltd/script.js'

const careersPageHtml = `
  <html>
    <head>
      <title>Careers &mdash; Prolifics US</title>
    </head>
    <body>
      <script>
        window.careersWidget = {
          site:"https://prolifics.zohorecruit.in",
          empty_job_msg:"No current Openings"
        }
      </script>
      <section>Prolifics careers</section>
    </body>
  </html>
`

const currentCareersPageHtml = `
  <html>
    <head><title>Prolifics Careers | Digital Engineering &amp; IT Jobs</title></head>
    <body>
      <h2>Discover Who We Are and Why It Matters</h2>
      <footer><h5>PROLIFICS RESOURCES</h5><a href="/careers">Careers</a></footer>
    </body>
  </html>
`

const portalMeta = {
  org_info: {
    website: 'https://prolifics.com/',
    company_name: 'Prolifics Corporation Private Limited',
  },
  list_url: 'https://prolifics.zohorecruit.in/jobs/Careers',
}

const portalHtml = `
  <html>
    <head>
      <meta property="og:url" content="https://prolifics.zohorecruit.in/jobs/Careers">
      <meta property="og:site_name" content="Prolifics Corporation Private Limited">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="meta" value="${
        JSON.stringify(portalMeta).replaceAll('"', '&quot;')
      }">
      <input type="hidden" id="jobs" value="[]">
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '156931000000111111',
      Posting_Title: 'SAP SD Lead Functional Consultant',
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '8+ years',
      Required_Skills: 'SAP SD, OTC',
      Date_Opened: '12/12/2025',
      Remote_Job: false,
      Publish: true,
      Job_Description: 'Implement SAP SD solutions for enterprise clients.',
      $url: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000111111/SAP-SD-Lead-Functional-Consultant?source=CareerSite',
    },
    {
      id: '156931000000222222',
      Posting_Title: 'Major Incident Manager',
      City: 'Pune',
      State: 'Maharashtra',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '6+ years',
      Required_Skills: 'ITIL, Incident Management',
      Date_Opened: '07/02/2026',
      Remote_Job: true,
      Publish: true,
      Job_Description: 'Coordinate major incident response for managed services.',
      $url: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000222222/Major-Incident-Manager?source=CareerSite',
    },
    {
      id: '156931000000333333',
      Posting_Title: 'US Data Architect',
      City: 'New York',
      Country: 'United States',
      Publish: true,
    },
    {
      id: '156931000000444444',
      Posting_Title: 'Nexivo Test JO',
      City: 'test',
      Country: 'India',
      Publish: true,
      $url: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000444444/Nexivo-Test-JO?source=CareerSite',
    },
  ],
}

test('Prolifics constants stay pinned to the verified official careers handoff and public Zoho jobs feed', () => {
  assert.equal(CAREERS_PAGE_URL, 'https://prolifics.ai/careers')
  assert.equal(CAREERS_PORTAL_URL, 'https://prolifics.zohorecruit.in/jobs/Careers')
  assert.equal(
    CAREERS_API_URL,
    'https://prolifics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(COMPANY, 'Prolifics Corporation Private Limited')
  assert.equal(SOURCE, 'prolificscorporationltd')
  assert.equal(hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(currentCareersPageHtml), true)
  assert.equal(hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs maps official Prolifics India openings and rejects non-India plus obvious test listings', () => {
  assert.deepEqual(extractIndiaJobs(apiPayload), [
    {
      title: 'SAP SD Lead Functional Consultant',
      company: 'Prolifics Corporation Private Limited',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '156931000000111111',
      requisitionId: '156931000000111111',
      sourceUrl: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000111111/SAP-SD-Lead-Functional-Consultant?source=CareerSite',
      applyUrl: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000111111/SAP-SD-Lead-Functional-Consultant?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '8+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['SAP SD', 'OTC'],
      postingDate: '12/12/2025',
      closingDate: null,
      jobDescription: 'Implement SAP SD solutions for enterprise clients.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Major Incident Manager',
      company: 'Prolifics Corporation Private Limited',
      department: null,
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: '156931000000222222',
      requisitionId: '156931000000222222',
      sourceUrl: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000222222/Major-Incident-Manager?source=CareerSite',
      applyUrl: 'https://prolifics.zohorecruit.in/jobs/Careers/156931000000222222/Major-Incident-Manager?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '6+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['ITIL', 'Incident Management'],
      postingDate: '07/02/2026',
      closingDate: null,
      jobDescription: 'Coordinate major incident response for managed services.',
      remoteStatus: 'Remote',
    },
  ])
})

test('run validates the Prolifics official careers handoff and portal before loading public India jobs', async () => {
  const requestedUrls = []
  const jobs = await createProlificsCorporationLtdScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_PAGE_URL) return careersPageHtml
      if (url === CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_API_URL) return apiPayload

      assert.fail(`Unexpected JSON request: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://prolifics.ai/careers',
    'https://prolifics.zohorecruit.in/jobs/Careers',
    'https://prolifics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'prolificscorporationltd')
  assert.equal(
    jobs[0].link,
    'https://prolifics.zohorecruit.in/jobs/Careers/156931000000111111/SAP-SD-Lead-Functional-Consultant?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('run fails closed when the verified Prolifics careers handoff disappears', async () => {
  await assert.rejects(
    createProlificsCorporationLtdScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_PAGE_URL) return '<html><body>Unexpected page</body></html>'
        return portalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Prolifics careers page/i,
  )
})
