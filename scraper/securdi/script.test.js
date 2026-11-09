import assert from 'node:assert/strict'
import test from 'node:test'

const loadSecurDIModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SecurDI scraper module at ./script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <section id="careers-home">
        <a href="https://jobs.securdi.com">Current Open Positions</a>
      </section>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Jobs at SecurDI</title>
      <meta property="og:url" content="https://jobs.securdi.com/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{&quot;theme&quot;:&quot;default&quot;}">
      <input
        type="hidden"
        id="moduleMeta"
        value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;,&quot;id&quot;:&quot;50211000000002481&quot;}]"
      >
      <input
        type="hidden"
        id="jobs"
        value="[{&quot;id&quot;:&quot;50211000005461100&quot;,&quot;Posting_Title&quot;:&quot;SailPoint Consultant&quot;}]"
      >
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '50211000005461100',
      Posting_Title: 'SailPoint Consultant',
      Job_Opening_Name: 'SailPoint Consultant',
      City: null,
      State: null,
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '3-5 Years',
      Date_Opened: '01/15/2025',
      Job_Description: 'Apply now and be a catalyst in transforming the world of Identity Governance and Administration control.',
      $url: 'https://securdi.zohorecruit.in/jobs/Careers/50211000005461100/SailPoint-Consultant?source=CareerSite',
    },
    {
      id: '50211000009999999',
      Posting_Title: 'US Identity Architect',
      Job_Opening_Name: 'US Identity Architect',
      City: 'Austin',
      State: 'Texas',
      Country: 'United States',
      Job_Type: 'Full time',
      Work_Experience: '8+ Years',
      Date_Opened: '01/20/2025',
      Job_Description: 'Design IAM platforms for US clients.',
      $url: 'https://securdi.zohorecruit.in/jobs/Careers/50211000009999999/US-Identity-Architect?source=CareerSite',
    },
  ],
}

test('SecurDI constants stay pinned to the verified official careers page, portal, and public jobs API', async () => {
  const securdi = await loadSecurDIModule()

  assert.equal(securdi.CAREERS_PAGE_URL, 'https://securdi.com/careers/')
  assert.equal(securdi.CAREERS_PORTAL_URL, 'https://jobs.securdi.com/jobs/Careers')
  assert.equal(
    securdi.CAREERS_API_URL,
    'https://jobs.securdi.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(securdi.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(securdi.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the SecurDI public jobs feed', async () => {
  const securdi = await loadSecurDIModule()

  assert.deepEqual(securdi.extractIndiaJobs(apiPayload), [{
    title: 'SailPoint Consultant',
    company: 'SecurDI',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: '50211000005461100',
    requisitionId: '50211000005461100',
    sourceUrl: 'https://securdi.zohorecruit.in/jobs/Careers/50211000005461100/SailPoint-Consultant?source=CareerSite',
    applyUrl: 'https://securdi.zohorecruit.in/jobs/Careers/50211000005461100/SailPoint-Consultant?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '3-5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '01/15/2025',
    closingDate: null,
    jobDescription: 'Apply now and be a catalyst in transforming the world of Identity Governance and Administration control.',
    remoteStatus: null,
  }])
})

test('run validates the verified SecurDI handoff before loading and decorating India jobs', async () => {
  const securdi = await loadSecurDIModule()
  const requestedUrls = []

  const jobs = await securdi.createSecurDIScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === securdi.CAREERS_PAGE_URL) return careersPageHtml
      if (url === securdi.CAREERS_PORTAL_URL) return portalHtml
      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    securdi.CAREERS_PAGE_URL,
    securdi.CAREERS_PORTAL_URL,
    securdi.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'securdi')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the verified SecurDI portal signal disappears', async () => {
  const securdi = await loadSecurDIModule()

  await assert.rejects(
    securdi.createSecurDIScraper().run({
      fetchText: async (url) => {
        if (url === securdi.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official SecurDI careers portal/i,
  )
})
