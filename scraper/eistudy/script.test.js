import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_API_URL,
  CAREERS_PORTAL_URL,
  createEIStudyScraper,
  extractIndiaJobs,
  hasOfficialPortalSignal,
} from './script.js'

const portalHtml = `
  <html lang="en">
    <head>
      <title>Jobs at EI India</title>
      <meta name="description" content="Everyone at EI India is free to explore and work the way you want. Come join us!">
      <meta property="og:url" content="https://talent.ei-india.com/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{&quot;detail&quot;:{&quot;section&quot;:{&quot;data&quot;:[{&quot;blocktype&quot;:&quot;jobs&quot;}]}}}">
      <input type="hidden" id="moduleMeta" value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;}]">
      <input type="hidden" id="jobs" value="[{&quot;id&quot;:&quot;9411000012870453&quot;}]">
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Job_Type: 'Full time',
      Job_Opening_Name: 'Head of Growth – Corporate Relations | Ei Shiksha',
      Posting_Title: 'Head of Growth – Corporate Relations | Ei Shiksha',
      Country: 'India',
      $url: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012870453/Head-of-Growth-%E2%80%93-Corporate-Relations-Ei-Shiksha?source=CareerSite',
      Is_Locked: false,
      id: '9411000012870453',
      City: 'Bangalore',
      Publish: true,
      Keep_on_Career_Site: false,
      Remote_Job: false,
    },
    {
      Job_Type: 'Contract',
      Job_Opening_Name: 'Mathematics Curriculum Specialist',
      Posting_Title: 'Mathematics Curriculum Specialist',
      Country: 'India',
      $url: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012833174/Mathematics-Curriculum-Specialist?source=CareerSite',
      id: '9411000012833174',
      City: 'Remote',
      Publish: true,
      Keep_on_Career_Site: false,
      Remote_Job: true,
    },
    {
      Job_Type: 'Full time',
      Job_Opening_Name: 'International Role',
      Posting_Title: 'International Role',
      Country: 'Singapore',
      $url: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000099999999/International-Role?source=CareerSite',
      id: '9411000099999999',
      City: 'Singapore',
      Publish: true,
      Keep_on_Career_Site: false,
      Remote_Job: false,
    },
  ],
}

test('EI Study constants stay pinned to the verified official public careers surface', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.ei.study/career')
  assert.equal(CAREERS_PORTAL_URL, 'https://talent.ei-india.com/jobs/Careers')
  assert.equal(
    CAREERS_API_URL,
    'https://talent.ei-india.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps official India openings and normalizes shared scraper fields', () => {
  assert.deepEqual(extractIndiaJobs(apiPayload), [
    {
      title: 'Head of Growth – Corporate Relations | Ei Shiksha',
      company: 'Educational Initiatives Pvt. Ltd.',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '9411000012870453',
      requisitionId: '9411000012870453',
      sourceUrl: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012870453/Head-of-Growth-%E2%80%93-Corporate-Relations-Ei-Shiksha?source=CareerSite',
      applyUrl: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012870453/Head-of-Growth-%E2%80%93-Corporate-Relations-Ei-Shiksha?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Mathematics Curriculum Specialist',
      company: 'Educational Initiatives Pvt. Ltd.',
      department: null,
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
      jobId: '9411000012833174',
      requisitionId: '9411000012833174',
      sourceUrl: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012833174/Mathematics-Curriculum-Specialist?source=CareerSite',
      applyUrl: 'https://ei-india.zohorecruit.in/jobs/Careers/9411000012833174/Mathematics-Curriculum-Specialist?source=CareerSite',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('run verifies the official EI portal before loading the public jobs API', async () => {
  const requestedUrls = []
  const jobs = await createEIStudyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_PORTAL_URL,
    CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'eistudy')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
})

test('run fails closed when the verified official EI jobs portal signal disappears', async () => {
  await assert.rejects(
    createEIStudyScraper().run({
      fetchText: async () => '<html><head><title>Educational Initiatives</title></head><body>No jobs here</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /official EI Study jobs portal/i,
  )
})
