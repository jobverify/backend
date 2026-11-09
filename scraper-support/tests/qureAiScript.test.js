import assert from 'node:assert/strict'
import test from 'node:test'

const encodeHtmlAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Qure.ai Careers</title>
  </head>
  <body>
    <main>
      <h1>Contribute to solutions impacting 15 million patients annually in over 100 countries.</h1>
      <a href="https://career.qure.ai/jobs/Careers">View Open Roles</a>
      <footer>Qure.ai Technologies Private Limited</footer>
    </main>
  </body>
</html>
`

const embeddedRecords = [
  {
    Remote_Job: false,
    Posting_Title: 'IT Infra Engineer',
    Is_Locked: false,
    City: 'Bangalore North',
    Job_Description:
      'About the job Job Title: IT Infra Engineer Department: Technology Location: Bangalore North Employment Type: Full Time',
    Work_Experience: '3-6 years',
    Job_Type: 'New',
    Job_Opening_Name: 'IT Infra Engineer',
    State: 'Karnataka',
    Country: 'India',
    id: '102070000016750008',
    Publish: true,
    Date_Opened: '2026-07-02',
  },
  {
    Remote_Job: false,
    Posting_Title: 'Business Strategy Analyst',
    Is_Locked: false,
    City: 'Mumbai',
    Job_Description:
      'About the job Job Title: Business Strategy Analyst Department: Strategy Location: Mumbai Employment Type: Full Time',
    Work_Experience: '2-4 years',
    Job_Type: 'Full time',
    Job_Opening_Name: 'Business Strategy Analyst',
    State: 'Maharashtra',
    Country: 'India',
    id: '102070000016510215',
    Publish: true,
    Date_Opened: '2026-06-22',
  },
  {
    Remote_Job: false,
    Posting_Title: 'Manager – Strategic Growth & Global Health Partnerships (West Africa)',
    Is_Locked: false,
    City: 'Kinshasa',
    Job_Description:
      'About the job Job Title: Manager - Strategic Growth & Global Health Partnerships (West Africa) Location: West Africa Employment Type: Consultant',
    Work_Experience: null,
    Job_Type: 'Replacement',
    Job_Opening_Name: 'Manager – Strategic Growth & Global Health Partnerships (West Africa)',
    State: 'Kinshasa',
    Country: 'Democratic Republic of the Congo',
    id: '102070000015091520',
    Publish: true,
    Date_Opened: '2026-03-13',
  },
]

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Careers</title>
    <meta property="og:url" content="https://career.qure.ai/jobs/Careers">
    <meta property="og:site_name" content="Qure ai Technologies Pvt Ltd">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" value="${encodeHtmlAttribute(JSON.stringify(embeddedRecords))}" id="jobs">
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Qure ai Technologies Pvt Ltd - IT Infra Engineer in Bangalore North</title>
    <meta property="og:url" content="https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite">
  </head>
  <body>
    <h1>IT Infra Engineer</h1>
    <p>Qure ai Technologies Pvt Ltd</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/qureai/script.js')
  } catch {
    assert.fail('Expected Qure.ai scraper module at ../../scraper/qureai/script.js')
  }
}

test('Qure.ai constants stay pinned to the verified first-party careers surfaces and detail URL contract', async () => {
  const qureAi = await loadModule()

  assert.equal(qureAi.SOURCE, 'qureai')
  assert.equal(qureAi.COMPANY, 'Qure.ai')
  assert.equal(qureAi.OFFICIAL_BRAND_NAME, 'Qure.ai')
  assert.equal(qureAi.CAREERS_PAGE_URL, 'https://jobs.qure.ai/')
  assert.equal(qureAi.CAREERS_PORTAL_URL, 'https://career.qure.ai/jobs/Careers')
  assert.equal(qureAi.EMBEDDED_JOBS_INPUT_ID, 'jobs')
  assert.equal(qureAi.hasOfficialCareersPageSignal(careersLandingHtml), true)
  assert.equal(qureAi.hasOfficialPortalSignal(portalHtml), true)
  assert.equal(
    qureAi.buildJobDetailUrl('102070000016750008', 'IT Infra Engineer'),
    'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
  )
})

test('Qure.ai extracts the embedded public jobs payload and keeps only India roles', async () => {
  const qureAi = await loadModule()

  assert.deepEqual(qureAi.extractEmbeddedJobsPayload(portalHtml), embeddedRecords)
  assert.deepEqual(qureAi.extractIndiaJobs(embeddedRecords), [
    {
      title: 'IT Infra Engineer',
      company: 'Qure.ai',
      department: null,
      location: 'Bangalore North, Karnataka, India',
      city: 'Bangalore North',
      state: 'Karnataka',
      country: 'India',
      jobId: '102070000016750008',
      requisitionId: '102070000016750008',
      sourceUrl: 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
      applyUrl: 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '3-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02',
      closingDate: null,
      jobDescription: 'About the job Job Title: IT Infra Engineer Department: Technology Location: Bangalore North Employment Type: Full Time',
      remoteStatus: 'On-site',
    },
    {
      title: 'Business Strategy Analyst',
      company: 'Qure.ai',
      department: null,
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '102070000016510215',
      requisitionId: '102070000016510215',
      sourceUrl: 'https://career.qure.ai/jobs/Careers/102070000016510215/Business-Strategy-Analyst?source=CareerSite',
      applyUrl: 'https://career.qure.ai/jobs/Careers/102070000016510215/Business-Strategy-Analyst?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-22',
      closingDate: null,
      jobDescription: 'About the job Job Title: Business Strategy Analyst Department: Strategy Location: Mumbai Employment Type: Full Time',
      remoteStatus: 'On-site',
    },
  ])
})

test('Qure.ai run validates the official careers portal and detail page before decorating India jobs', async () => {
  const qureAi = await loadModule()
  const pageRequests = []

  const jobs = await qureAi.createQureAiScraper({
    now: () => '2026-07-17T12:00:00.000Z',
    maxJobs: 1,
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === qureAi.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === qureAi.CAREERS_PORTAL_URL) {
        return { status: 200, url, html: portalHtml }
      }

      if (url === 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite') {
        return { status: 200, url, html: detailPageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    qureAi.CAREERS_PAGE_URL,
    qureAi.CAREERS_PORTAL_URL,
    'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'IT Infra Engineer',
      company: 'Qure.ai',
      department: null,
      location: 'Bangalore North, Karnataka, India',
      city: 'Bangalore North',
      state: 'Karnataka',
      country: 'India',
      jobId: '102070000016750008',
      requisitionId: '102070000016750008',
      sourceUrl: 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
      applyUrl: 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '3-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02',
      closingDate: null,
      jobDescription: 'About the job Job Title: IT Infra Engineer Department: Technology Location: Bangalore North Employment Type: Full Time',
      remoteStatus: 'On-site',
      source: 'qureai',
      companyCareerPage: 'https://jobs.qure.ai/',
      companyDomain: 'qure.ai',
      atsPlatform: 'zohorecruit-embedded',
      link: 'https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite',
      scrapedAt: '2026-07-17T12:00:00.000Z',
    },
  ])
})

test('Qure.ai fails closed when the verified portal markers or detail page drift materially', async () => {
  const qureAi = await loadModule()

  await assert.rejects(
    qureAi.createQureAiScraper().run({
      fetchPage: async (url) => {
        if (url === qureAi.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === qureAi.CAREERS_PORTAL_URL) {
          return { status: 200, url, html: '<html><body>No embedded jobs here.</body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /official Qure\.ai careers portal/i,
  )

  await assert.rejects(
    qureAi.createQureAiScraper({
      maxJobs: 1,
    }).run({
      fetchPage: async (url) => {
        if (url === qureAi.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === qureAi.CAREERS_PORTAL_URL) {
          return { status: 200, url, html: portalHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><head><title>Other company</title></head><body>placeholder</body></html>',
        }
      },
    }),
    /Qure\.ai job detail pages no longer match the verified public jobs surface/i,
  )
})
