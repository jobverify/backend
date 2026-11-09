import assert from 'node:assert/strict'
import test from 'node:test'

const loadIndiumSoftwareModule = async () => {
  try {
    return await import('../../scraper/indiumsoftware/script.js')
  } catch {
    assert.fail('Expected Indium Software scraper module at ../../scraper/indiumsoftware/script.js')
  }
}

const portalHtml = `
  <html>
    <head>
      <title>Jobs at Careers</title>
      <meta property="og:url" content="https://indiumsoft.zohorecruit.com/jobs/Careers">
    </head>
    <body>
      <h2>Current Openings</h2>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <div id="jobs" data-payload="[]"></div>
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '668572000021002942',
      Job_Opening_Name: 'Microservices Developer',
      Posting_Title: 'Microservices Developer',
      Job_Type: 'Permanent',
      City: 'Bengaluru',
      State: 'Karnataka',
      Country: 'India',
      Date_Opened: '05/08/2024',
      $url: 'https://indiumsoft.zohorecruit.com/jobs/Careers/668572000021002942/Microservices-Developer?source=CareerSite',
      Job_Description: 'Title: Microservices Developer',
    },
    {
      id: '668572000032196049',
      Job_Opening_Name: 'AWS DevOps Engineer',
      Posting_Title: 'AWS DevOps Engineer',
      Job_Type: 'Permanent',
      City: 'Chennai',
      State: 'Tamilnadu',
      Country: 'India',
      Date_Opened: '01/08/2025',
      $url: 'https://indiumsoft.zohorecruit.com/jobs/Careers/668572000032196049/AWS-DevOps-Engineer?source=CareerSite',
      Job_Description: 'Bose Device DevOps Offshore JD',
    },
    {
      id: '668572000040734849',
      Job_Opening_Name: 'US Hackathon',
      Posting_Title: 'US Hackathon',
      Job_Type: 'Permanent',
      City: 'Frisco',
      State: 'Texas',
      Country: 'United States',
      Date_Opened: '07/03/2025',
      $url: 'https://indiumsoft.zohorecruit.com/jobs/Careers/668572000040734849/US-Hackathon?source=CareerSite',
    },
  ],
}

test('Indium Software constants stay pinned to the official public Zoho Recruit careers surface', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()

  assert.equal(indiumSoftware.CAREERS_PORTAL_URL, 'https://indiumsoft.zohorecruit.com/jobs/Careers')
  assert.equal(
    indiumSoftware.CAREERS_API_URL,
    'https://indiumsoft.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(indiumSoftware.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the Indium Software public jobs feed', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()
  const jobs = indiumSoftware.extractIndiaJobs(apiPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Microservices Developer',
    company: 'Indium Software',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '668572000021002942',
    requisitionId: '668572000021002942',
    sourceUrl: 'https://indiumsoft.zohorecruit.com/jobs/Careers/668572000021002942/Microservices-Developer?source=CareerSite',
    applyUrl: 'https://indiumsoft.zohorecruit.com/jobs/Careers/668572000021002942/Microservices-Developer?source=CareerSite',
    employmentType: 'Permanent',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '05/08/2024',
    closingDate: null,
    jobDescription: 'Title: Microservices Developer',
    publicExperienceChecked: false,
    remoteStatus: 'On-site',
  })
})

test('extractIndiaJobs infers experience from substantive Indium Software public descriptions and marks verified-missing rich descriptions as checked', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()
  const jobs = indiumSoftware.extractIndiaJobs({
    code: 'success',
    data: [
      {
        id: '1',
        Job_Opening_Name: 'Devops Architect',
        Posting_Title: 'Devops Architect',
        Job_Type: 'Permanent',
        City: 'Chennai',
        State: 'Tamil Nadu',
        Country: 'India',
        Date_Opened: '04/08/2026',
        $url: 'https://indiumsoft.zohorecruit.com/jobs/Careers/1/Devops-Architect?source=CareerSite',
        Job_Description:
          'Role title: Dev Ops Architect. Work Location - Chennai. Required Skills: Experience in Devops Consulting, Solutioning and Implementations. Minimum 8 years of experience in cloud-native architecture and CI/CD modernization.',
      },
      {
        id: '2',
        Job_Opening_Name: 'Test Engineer',
        Posting_Title: 'Test Engineer',
        Job_Type: 'Permanent',
        City: 'Bengaluru',
        State: 'Karnataka',
        Country: 'India',
        Date_Opened: '04/08/2026',
        $url: 'https://indiumsoft.zohorecruit.com/jobs/Careers/2/Test-Engineer?source=CareerSite',
        Job_Description:
          'Should have expert Communication Skills. Expertise testing on Mobile Platform. Should have hands on experience using Charles Proxy. Should have hands on experience using Jira, Asana and TestRail. Should be able to support release validation and client reporting.',
      },
    ],
  })

  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('run validates the Indium official portal before fetching and decorating India jobs', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()
  const requestedUrls = []

  const jobs = await indiumSoftware.createIndiumSoftwareScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [indiumSoftware.CAREERS_PORTAL_URL, indiumSoftware.CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'indiumsoftware')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
  assert.equal(jobs[0].publicExperienceChecked, false)
})

test('run falls back to a browser-backed portal loader when Node fetch times out', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()
  const requestedPortalUrls = []
  const requestedBrowserUrls = []
  const requestedPrimaryApiUrls = []
  const requestedBrowserApiUrls = []

  const jobs = await indiumSoftware.createIndiumSoftwareScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPortalUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      requestedBrowserUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedPrimaryApiUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserJson: async (url, landingUrl) => {
      requestedBrowserApiUrls.push({ url, landingUrl })
      return apiPayload
    },
    now: () => '2026-08-02T10:00:00.000Z',
  })

  assert.deepEqual(requestedPortalUrls, [indiumSoftware.CAREERS_PORTAL_URL])
  assert.deepEqual(requestedBrowserUrls, [indiumSoftware.CAREERS_PORTAL_URL])
  assert.deepEqual(requestedPrimaryApiUrls, [indiumSoftware.CAREERS_API_URL])
  assert.deepEqual(requestedBrowserApiUrls, [
    {
      url: indiumSoftware.CAREERS_API_URL,
      landingUrl: indiumSoftware.CAREERS_PORTAL_URL,
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '668572000021002942')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T10:00:00.000Z')
})

test('run fails closed when the Indium official portal signal disappears', async () => {
  const indiumSoftware = await loadIndiumSoftwareModule()

  await assert.rejects(
    indiumSoftware.createIndiumSoftwareScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /official Indium careers portal/i,
  )
})
