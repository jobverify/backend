import assert from 'node:assert/strict'
import test from 'node:test'

const loadSecurinModule = async () => {
  try {
    return await import('../../scraper/securinindiapvtltd/script.js')
  } catch {
    assert.fail('Expected Securin India Pvt Ltd scraper module at ../../scraper/securinindiapvtltd/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <footer>
        <a href="https://careers.securin.io/jobs/Careers">Careers</a>
      </footer>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Jobs at Securin</title>
      <meta property="og:url" content="https://careers.securin.io/jobs/Careers">
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
      id: '35163000008275127',
      Posting_Title: 'Intern - Security Analyst',
      Job_Opening_Name: 'Intern - Security Analyst',
      City: 'Chennai',
      State: 'Tamil Nadu',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Mode: 'On Site',
      Date_Opened: '09/03/2025',
      Job_Description: 'Support proactive vulnerability management.',
      $url: 'https://careers.securin.io/jobs/Careers/35163000008275127/Intern---Security-Analyst?source=CareerSite',
    },
    {
      id: '35163000010303075',
      Posting_Title: 'Summer Intern - Communications + Marketing Intern',
      Job_Opening_Name: 'Summer Intern - Communications + Marketing Intern',
      City: 'Albuquerque',
      State: 'New Mexico',
      Country: 'United States',
      Job_Type: 'Full time',
      Work_Mode: 'Hybrid',
      $url: 'https://careers.securin.io/jobs/Careers/35163000010303075/Summer-Intern---Communications-Marketing-Intern?source=CareerSite',
    },
  ],
}

test('Securin constants stay pinned to the verified official careers page, portal, and public jobs API', async () => {
  const securin = await loadSecurinModule()

  assert.equal(securin.CAREERS_PAGE_URL, 'https://www.securin.io/')
  assert.equal(securin.CAREERS_PORTAL_URL, 'https://careers.securin.io/jobs/Careers')
  assert.equal(
    securin.CAREERS_API_URL,
    'https://careers.securin.io/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(securin.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(securin.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the Securin public jobs feed', async () => {
  const securin = await loadSecurinModule()

  assert.deepEqual(securin.extractIndiaJobs(apiPayload), [{
    title: 'Intern - Security Analyst',
    company: 'Securin India Pvt Ltd',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: '35163000008275127',
    requisitionId: '35163000008275127',
    sourceUrl: 'https://careers.securin.io/jobs/Careers/35163000008275127/Intern---Security-Analyst?source=CareerSite',
    applyUrl: 'https://careers.securin.io/jobs/Careers/35163000008275127/Intern---Security-Analyst?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '09/03/2025',
    closingDate: null,
    jobDescription: 'Support proactive vulnerability management.',
    remoteStatus: 'On-site',
  }])
})

test('run validates the verified Securin handoff before loading and decorating India jobs', async () => {
  const securin = await loadSecurinModule()
  const requestedUrls = []

  const jobs = await securin.createSecurinIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === securin.CAREERS_PAGE_URL) return careersPageHtml
      if (url === securin.CAREERS_PORTAL_URL) return portalHtml
      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    securin.CAREERS_PAGE_URL,
    securin.CAREERS_PORTAL_URL,
    securin.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'securinindiapvtltd')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the verified Securin portal signal disappears', async () => {
  const securin = await loadSecurinModule()

  await assert.rejects(
    securin.createSecurinIndiaScraper().run({
      fetchText: async (url) => {
        if (url === securin.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Securin careers portal/i,
  )
})
