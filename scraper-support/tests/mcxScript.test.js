import assert from 'node:assert/strict'
import test from 'node:test'

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <div id="current-openings">
        <select id="selectJobRole"></select>
        <select id="selectLocation"></select>
      </div>
      <a href="/careers/apply-online">Apply Online</a>
      <script src="/assets/customjs/CurrentOpening.js"></script>
      <p>careers@mcxindia.com</p>
    </main>
  </body>
</html>
`

const applyOnlineHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Apply Online</title>
  </head>
  <body>
    <main>
      <h1>Apply Online</h1>
      <section id="current-opening-apply"></section>
      <input type="hidden" id="careerstoken">
      <button id="SubmitButton1">Next</button>
      <p>careers@mcxindia.com</p>
    </main>
  </body>
</html>
`

const announcementsPayload = {
  Announcements: [
    {
      Title: 'PMT(Base Metals) - Senior Executive - Mumbai',
      PublishedDate: '07 May 2026',
      JobRole: 'PMT(Base Metals) - Senior Executive - Mumbai',
      Qualification: null,
      QualificationDisplay: 'MBA',
      sortExperience: '',
      Location: 'Mumbai',
      Experience: '-',
      JobResponsibility:
        '<ul><li>Prepare promotional material.</li><li>Track developments in the product group.</li></ul>',
      MinimumExperience: null,
      MaximumExperience: null,
    },
    {
      Title: 'Manager – Information Security',
      PublishedDate: '07 May 2026',
      JobRole: 'Manager – Information Security',
      Qualification: null,
      QualificationDisplay: "Bachelor's degree in information technology, Computer Science or a related field.",
      sortExperience: '8-10',
      Location: 'Mumbai',
      Experience: '8-10 yrs.',
      JobResponsibility:
        '<ul><li>Understanding of SAST/DAST tools.</li><li>Coordinate IT and cyber audits.</li></ul>',
      MinimumExperience: '8',
      MaximumExperience: '10',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/mcx/script.js')
  } catch {
    assert.fail('Expected MCX scraper module at ../../scraper/mcx/script.js')
  }
}

test('MCX validates the verified current openings shell, apply page, and announcements feed', async () => {
  const mcx = await loadModule()

  assert.equal(mcx.HOMEPAGE_URL, 'https://www.mcxindia.com/')
  assert.equal(mcx.CAREERS_URL, 'https://www.mcxindia.com/careers/job-openings')
  assert.equal(mcx.JOBS_API_URL, 'https://www.mcxindia.com/careers/job-openings/GetFilteredAnnouncements')
  assert.equal(mcx.JOB_DETAIL_URL, 'https://www.mcxindia.com/careers/job-openings/job-detail')
  assert.equal(mcx.APPLY_URL, 'https://www.mcxindia.com/careers/apply-online')
  assert.equal(mcx.VERIFIED_ON, '2026-08-03')
  assert.equal(mcx.hasVerifiedCurrentOpeningsPageSignal(currentOpeningsHtml), true)
  assert.equal(mcx.hasVerifiedApplyOnlineSignal(applyOnlineHtml), true)
  assert.equal(mcx.hasAnnouncementsPayloadSignal(announcementsPayload), true)
})

test('MCX normalizes first-party announcements into India jobs with detail URLs', async () => {
  const mcx = await loadModule()

  assert.deepEqual(
    announcementsPayload.Announcements.map((item) => mcx.normalizeAnnouncement(item, '2026-08-03T00:00:00.000Z')),
    [
      {
        title: 'PMT(Base Metals) - Senior Executive - Mumbai',
        company: 'MCX',
        department: null,
        location: 'Mumbai, India',
        city: 'Mumbai',
        country: 'India',
        jobId: 'mcx-pmt-base-metals-senior-executive-mumbai-mumbai',
        requisitionId: 'mcx-pmt-base-metals-senior-executive-mumbai-mumbai',
        sourceUrl: 'https://www.mcxindia.com/careers/job-openings/job-detail?JobRole=PMT%28Base+Metals%29+-+Senior+Executive+-+Mumbai',
        applyUrl: 'https://www.mcxindia.com/careers/apply-online',
        employmentType: null,
        workplaceType: null,
        experienceRequired: null,
        minimumQualification: 'MBA',
        preferredQualification: null,
        requiredSkills: [],
        compensation: null,
        postingDate: '07 May 2026',
        closingDate: null,
        jobDescription: [
          'Role: PMT(Base Metals) - Senior Executive - Mumbai',
          'Location: Mumbai',
          'Qualification Profile: MBA',
          'Job Responsibilities:',
          '- Prepare promotional material.',
          '- Track developments in the product group.',
        ].join('\n'),
        source: 'mcx',
        companyCareerPage: 'https://www.mcxindia.com/careers/job-openings',
        companyDomain: 'www.mcxindia.com',
        atsPlatform: 'official-company-careers',
        link: 'https://www.mcxindia.com/careers/apply-online',
        scrapedAt: '2026-08-03T00:00:00.000Z',
      },
      {
        title: 'Manager – Information Security',
        company: 'MCX',
        department: null,
        location: 'Mumbai, India',
        city: 'Mumbai',
        country: 'India',
        jobId: 'mcx-manager-information-security-mumbai',
        requisitionId: 'mcx-manager-information-security-mumbai',
        sourceUrl: 'https://www.mcxindia.com/careers/job-openings/job-detail?JobRole=Manager+%E2%80%93+Information+Security',
        applyUrl: 'https://www.mcxindia.com/careers/apply-online',
        employmentType: null,
        workplaceType: null,
        experienceRequired: '8-10 yrs.',
        minimumQualification: "Bachelor's degree in information technology, Computer Science or a related field.",
        preferredQualification: null,
        requiredSkills: [],
        compensation: null,
        postingDate: '07 May 2026',
        closingDate: null,
        jobDescription: [
          'Role: Manager – Information Security',
          'Location: Mumbai',
          "Qualification Profile: Bachelor's degree in information technology, Computer Science or a related field.",
          'Experience: 8-10 yrs.',
          'Job Responsibilities:',
          '- Understanding of SAST/DAST tools.',
          '- Coordinate IT and cyber audits.',
        ].join('\n'),
        source: 'mcx',
        companyCareerPage: 'https://www.mcxindia.com/careers/job-openings',
        companyDomain: 'www.mcxindia.com',
        atsPlatform: 'official-company-careers',
        link: 'https://www.mcxindia.com/careers/apply-online',
        scrapedAt: '2026-08-03T00:00:00.000Z',
      },
    ],
  )
})

test('MCX run returns normalized jobs from the verified main-site current openings contract', async () => {
  const mcx = await loadModule()
  const requestedTexts = []
  const requestedJsons = []

  const jobs = await mcx.createMcxScraper({
    now: () => '2026-08-03T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === mcx.CAREERS_URL) return currentOpeningsHtml
      if (url === mcx.APPLY_URL) return applyOnlineHtml
      throw new Error(`Unexpected MCX text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsons.push(url)
      return announcementsPayload
    },
  })

  assert.deepEqual(requestedTexts, [mcx.CAREERS_URL, mcx.APPLY_URL])
  assert.deepEqual(requestedJsons, [mcx.JOBS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'PMT(Base Metals) - Senior Executive - Mumbai')
  assert.equal(jobs[1].title, 'Manager – Information Security')
})

test('MCX fails closed if the verified current openings shell or announcements feed disappear', async () => {
  const mcx = await loadModule()

  await assert.rejects(
    mcx.createMcxScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => announcementsPayload,
    }),
    /verified mcx current openings page/i,
  )

  await assert.rejects(
    mcx.createMcxScraper().run({
      fetchText: async (url) => (url === mcx.CAREERS_URL ? currentOpeningsHtml : applyOnlineHtml),
      fetchJson: async () => ({ Announcements: [] }),
    }),
    /first-party announcements contract/i,
  )
})
