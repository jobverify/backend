import assert from 'node:assert/strict'
import test from 'node:test'

const loadSkyrootAerospaceModule = async () => {
  try {
    return await import('../../scraper/skyrootaerospace/script.js')
  } catch {
    assert.fail('Expected Skyroot Aerospace scraper module at ../../scraper/skyrootaerospace/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <a href="https://skyroot.zohorecruit.in/jobs/Careers">Explore careers</a>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <meta property="og:url" content="https://skyroot.zohorecruit.in/jobs/Careers">
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
      id: '62390000001234567',
      Job_Opening_Name: 'Avionics Engineer',
      Posting_Title: 'Avionics Engineer',
      Job_Type: 'Full time',
      Department: 'Avionics',
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      Date_Opened: '2026-07-01',
      Remote_Job: false,
      Job_Description: 'Build flight electronics.',
      Skill_Set: 'Embedded C, RTOS',
      $url: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000001234567/Avionics-Engineer?source=CareerSite',
    },
    {
      id: '62390000007654321',
      Job_Opening_Name: 'Mission Ops Intern',
      Posting_Title: 'Mission Ops Intern',
      Job_Type: 'Internship',
      Department: 'Mission Operations',
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      Date_Opened: '2026-07-02',
      Remote_Job: true,
      Job_Description: 'Support launch rehearsals.',
      Skill_Set: ['Python', 'Data Analysis'],
      $url: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000007654321/Mission-Ops-Intern?source=CareerSite',
    },
    {
      id: '62390000009999999',
      Job_Opening_Name: 'US Launch Counsel',
      Posting_Title: 'US Launch Counsel',
      Job_Type: 'Full time',
      Department: 'Legal',
      City: 'Los Angeles',
      State: 'California',
      Country: 'United States',
      $url: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000009999999/US-Launch-Counsel?source=CareerSite',
    },
  ],
}

test('Skyroot Aerospace constants stay pinned to the official careers, portal, and public jobs API surfaces', async () => {
  const skyrootAerospace = await loadSkyrootAerospaceModule()

  assert.equal(skyrootAerospace.CAREERS_PAGE_URL, 'https://www.skyroot.in/careers')
  assert.equal(skyrootAerospace.CAREERS_PORTAL_URL, 'https://skyroot.zohorecruit.in/jobs/Careers')
  assert.equal(
    skyrootAerospace.CAREERS_API_URL,
    'https://skyroot.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(skyrootAerospace.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(skyrootAerospace.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the Skyroot Aerospace public jobs feed and derives apply URLs', async () => {
  const skyrootAerospace = await loadSkyrootAerospaceModule()
  const jobs = skyrootAerospace.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Avionics Engineer',
      company: 'Skyroot Aerospace',
      department: 'Avionics',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '62390000001234567',
      requisitionId: '62390000001234567',
      sourceUrl: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000001234567/Avionics-Engineer?source=CareerSite',
      applyUrl: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000001234567/Avionics-Engineer?source=CareerSite&$apply=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Embedded C', 'RTOS'],
      postingDate: '2026-07-01',
      closingDate: null,
      jobDescription: 'Build flight electronics.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Mission Ops Intern',
      company: 'Skyroot Aerospace',
      department: 'Mission Operations',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '62390000007654321',
      requisitionId: '62390000007654321',
      sourceUrl: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000007654321/Mission-Ops-Intern?source=CareerSite',
      applyUrl: 'https://skyroot.zohorecruit.in/jobs/Careers/62390000007654321/Mission-Ops-Intern?source=CareerSite&$apply=true',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Python', 'Data Analysis'],
      postingDate: '2026-07-02',
      closingDate: null,
      jobDescription: 'Support launch rehearsals.',
      remoteStatus: 'Remote',
    },
  ])
})

test('run validates the Skyroot careers handoff and official portal before fetching and decorating India jobs', async () => {
  const skyrootAerospace = await loadSkyrootAerospaceModule()
  const requestedUrls = []

  const jobs = await skyrootAerospace.createSkyrootAerospaceScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === skyrootAerospace.CAREERS_PAGE_URL) return careersPageHtml
      if (url === skyrootAerospace.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    skyrootAerospace.CAREERS_PAGE_URL,
    skyrootAerospace.CAREERS_PORTAL_URL,
    skyrootAerospace.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'skyrootaerospace')
  assert.equal(
    jobs[0].link,
    'https://skyroot.zohorecruit.in/jobs/Careers/62390000001234567/Avionics-Engineer?source=CareerSite&$apply=true',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the Skyroot official portal signal disappears', async () => {
  const skyrootAerospace = await loadSkyrootAerospaceModule()

  await assert.rejects(
    skyrootAerospace.createSkyrootAerospaceScraper().run({
      fetchText: async (url) => {
        if (url === skyrootAerospace.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Skyroot careers portal/i,
  )
})
