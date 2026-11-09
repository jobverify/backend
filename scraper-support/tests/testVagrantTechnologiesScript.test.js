import assert from 'node:assert/strict'
import test from 'node:test'

const loadTestVagrantTechnologiesModule = async () => {
  try {
    return await import('../../scraper/testvagranttechnologies/script.js')
  } catch {
    assert.fail('Expected TestVagrant Technologies scraper module at ../../scraper/testvagranttechnologies/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <a href="https://testvagrant.zohorecruit.com/jobs/Careers">View openings</a>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <meta property="og:url" content="https://testvagrant.zohorecruit.com/jobs/Careers">
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
      id: '566350000021644728',
      Job_Opening_Name: 'SDET',
      Posting_Title: 'SDET',
      Job_Type: 'Full time',
      Industry: 'Technology',
      City: 'Bangalore North',
      Country: 'India',
      Job_Description: 'Build automation and product quality systems.',
      $url: 'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021644728/SDET?source=CareerSite',
    },
    {
      id: '566350000021732022',
      Job_Opening_Name: 'Lead Software Development Engineer in Test (Lead SDET)',
      Posting_Title: 'Lead Software Development Engineer in Test (Lead SDET)',
      Job_Type: 'Full time',
      Industry: 'IT Services',
      City: 'Bangalore North',
      Country: 'India',
      $url:
        'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021732022/Lead-Software-Development-Engineer-in-Test-Lead-SDET?source=CareerSite',
    },
    {
      id: '566350000099999999',
      Job_Opening_Name: 'US QA Architect',
      Posting_Title: 'US QA Architect',
      Job_Type: 'Full time',
      City: 'Austin',
      Country: 'United States',
      $url: 'https://testvagrant.zohorecruit.com/jobs/Careers/566350000099999999/US-QA-Architect?source=CareerSite',
    },
  ],
}

test('TestVagrant Technologies constants stay pinned to the verified official careers, portal, and public jobs API surfaces', async () => {
  const testVagrantTechnologies = await loadTestVagrantTechnologiesModule()

  assert.equal(testVagrantTechnologies.CAREERS_PAGE_URL, 'https://www.testvagrant.com/careers/')
  assert.equal(testVagrantTechnologies.CAREERS_PORTAL_URL, 'https://testvagrant.zohorecruit.com/jobs/Careers')
  assert.equal(
    testVagrantTechnologies.CAREERS_API_URL,
    'https://testvagrant.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(testVagrantTechnologies.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(testVagrantTechnologies.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the TestVagrant Technologies public jobs feed and derives apply URLs', async () => {
  const testVagrantTechnologies = await loadTestVagrantTechnologiesModule()
  const jobs = testVagrantTechnologies.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'SDET',
      company: 'TestVagrant Technologies',
      department: null,
      location: 'Bangalore North, India',
      city: 'Bangalore North',
      state: null,
      country: 'India',
      jobId: '566350000021644728',
      requisitionId: '566350000021644728',
      sourceUrl: 'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021644728/SDET?source=CareerSite',
      applyUrl: 'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021644728/SDET?source=CareerSite&$apply=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build automation and product quality systems.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead Software Development Engineer in Test (Lead SDET)',
      company: 'TestVagrant Technologies',
      department: null,
      location: 'Bangalore North, India',
      city: 'Bangalore North',
      state: null,
      country: 'India',
      jobId: '566350000021732022',
      requisitionId: '566350000021732022',
      sourceUrl:
        'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021732022/Lead-Software-Development-Engineer-in-Test-Lead-SDET?source=CareerSite',
      applyUrl:
        'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021732022/Lead-Software-Development-Engineer-in-Test-Lead-SDET?source=CareerSite&$apply=true',
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
  ])
})

test('run validates the TestVagrant careers handoff and official portal before fetching and decorating India jobs', async () => {
  const testVagrantTechnologies = await loadTestVagrantTechnologiesModule()
  const requestedUrls = []

  const jobs = await testVagrantTechnologies.createTestVagrantTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === testVagrantTechnologies.CAREERS_PAGE_URL) return careersPageHtml
      if (url === testVagrantTechnologies.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    testVagrantTechnologies.CAREERS_PAGE_URL,
    testVagrantTechnologies.CAREERS_PORTAL_URL,
    testVagrantTechnologies.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'testvagranttechnologies')
  assert.equal(
    jobs[0].link,
    'https://testvagrant.zohorecruit.com/jobs/Careers/566350000021644728/SDET?source=CareerSite&$apply=true',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the TestVagrant official portal signal disappears', async () => {
  const testVagrantTechnologies = await loadTestVagrantTechnologiesModule()

  await assert.rejects(
    testVagrantTechnologies.createTestVagrantTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === testVagrantTechnologies.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official TestVagrant careers portal/i,
  )
})
