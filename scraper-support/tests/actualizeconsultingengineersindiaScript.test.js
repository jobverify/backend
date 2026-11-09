import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_PORTAL_URL,
  createActualizeConsultingEngineersIndiaScraper,
  extractIndiaJobs,
  hasOfficialPortalSignal,
} from '../../scraper/actualizeconsultingengineersindia/script.js'

const portalHtml = `
  <html>
    <head>
      <title>Jobs at PeoplePlus</title>
      <meta property="og:url" content="https://actualize.zohorecruit.in/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '1234567890',
      Posting_Title: 'Embedded Software Engineer',
      City: 'Bengaluru',
      State: 'Karnataka',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '3 years',
      Required_Skills: 'C++, AUTOSAR',
      Date_Opened: '2026-07-01',
      Remote_Job: false,
      Job_Description: 'Develop embedded software.',
      $url: 'https://actualize.zohorecruit.in/jobs/Careers/1234567890/Embedded-Software-Engineer?source=CareerSite',
    },
    {
      id: '1234567891',
      Posting_Title: 'US Software Engineer',
      City: 'Austin',
      Country: 'United States',
    },
  ],
}

test('Actualize constants stay pinned to its official public Zoho Recruit careers portal', () => {
  assert.equal(CAREERS_PORTAL_URL, 'https://actualize.zohorecruit.in/jobs/Careers')
  assert.equal(
    CAREERS_API_URL,
    'https://actualize.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs maps official Actualize India openings and excludes non-India roles', () => {
  assert.deepEqual(extractIndiaJobs(apiPayload), [{
    title: 'Embedded Software Engineer',
    company: 'Actualize Consulting Engineers India Pvt Ltd',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '1234567890',
    requisitionId: '1234567890',
    sourceUrl: 'https://actualize.zohorecruit.in/jobs/Careers/1234567890/Embedded-Software-Engineer?source=CareerSite',
    applyUrl: 'https://actualize.zohorecruit.in/jobs/Careers/1234567890/Embedded-Software-Engineer?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['C++', 'AUTOSAR'],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Develop embedded software.',
    remoteStatus: 'On-site',
  }])
})

test('run validates Actualize official portal before loading and decorating public India jobs', async () => {
  const requestedUrls = []
  const jobs = await createActualizeConsultingEngineersIndiaScraper().run({
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

  assert.deepEqual(requestedUrls, [CAREERS_PORTAL_URL, CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'actualizeconsultingengineersindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
})

test('run fails closed when the official Actualize careers portal signal disappears', async () => {
  await assert.rejects(
    createActualizeConsultingEngineersIndiaScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /official Actualize careers portal/i,
  )
})
