import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T12:00:00.000Z'

const officialContactHtml = `
  <html lang="en">
    <head>
      <title>Contact</title>
    </head>
    <body>
      <main>
        <h1>All roads lead to</h1>
        <section>
          <h2>For Careers</h2>
          <p>Now open to everyone – from product builders and problem solvers, to marketing hustlers and community leaders.</p>
          <span>Check out jobs</span>
          <a href="https://jupiter.keka.com/careers" target="_blank" rel="noopener noreferrer">Current Openings</a>
        </section>
      </main>
    </body>
  </html>
`

const kekaShellHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Careers at Jupiter Money</title>
    </head>
    <body>
      <div id="content-container"></div>
      <script>
        fetch('/ats/documents/b5279857-cf81-4dde-a215-fc48957ee2b5/careerportal/18096d20247d4ecfa4efcf04875cbda6.html')
      </script>
    </body>
  </html>
`

const embeddedCareersHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>
        window.khConfig = {
          identifier: 'b5279857-cf81-4dde-a215-fc48957ee2b5',
          domain: 'https://jupiter.keka.com/careers/',
          targetContainer: '#khembedjobs'
        }
      </script>
      <script src="https://jupiter.keka.com/careers/api/embedjobs/js/b5279857-cf81-4dde-a215-fc48957ee2b5" defer></script>
    </head>
    <body></body>
  </html>
`

const portalInfoPayload = {
  name: 'Jupiter Money',
  shortName: 'Jupiter Money',
  careersPortalDomain: 'jupiter.keka.com',
}

const activeJobsPayload = [
  {
    id: 134831,
    title: 'Devops Engineer - SDE 2',
    description: '<div>Build secure and scalable AWS infrastructure.</div>',
    departmentName: 'Engineering',
    excerpt: 'Build secure and scalable AWS infrastructure.',
    jobLocations: [
      {
        id: 31395,
        name: 'Europa Bangalore',
        city: 'Bengaluru',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '3-5',
    publishedOn: '2026-07-15T07:26:49.647Z',
    skillNames: [],
  },
  {
    id: 134239,
    title: 'Hr Operations Lead',
    description: '<div>Own and drive the end-to-end employee lifecycle.</div>',
    departmentName: 'HR Operation',
    excerpt: 'Own and drive the end-to-end employee lifecycle.',
    jobLocations: [],
    jobType: 2,
    experience: '5-8 Years',
    publishedOn: '2026-07-08T12:02:46.923Z',
    skillNames: ['operations', 'communication skills', 'PAYROLL'],
  },
]

const loadJupiterMoneyModule = async () => {
  try {
    return await import('../../scraper/jupitermoney/script.js')
  } catch {
    assert.fail('Expected Jupiter Money scraper module at ../../scraper/jupitermoney/script.js')
  }
}

test('Jupiter Money pins the verified first-party Keka handoff and helper contracts', async () => {
  const jupiterMoney = await loadJupiterMoneyModule()

  assert.equal(jupiterMoney.SOURCE, 'jupitermoney')
  assert.equal(jupiterMoney.COMPANY_NAME, 'Jupiter Money')
  assert.equal(jupiterMoney.OFFICIAL_BRAND_NAME, 'Jupiter Money')
  assert.equal(jupiterMoney.HOMEPAGE_URL, 'https://jupiter.money/')
  assert.equal(jupiterMoney.ABOUT_PAGE_URL, 'https://jupiter.money/about-us/')
  assert.equal(jupiterMoney.OFFICIAL_CAREERS_URL, 'https://jupiter.money/contact/')
  assert.equal(jupiterMoney.EXTERNAL_HANDOFF_URL, 'https://jupiter.keka.com/careers')
  assert.equal(
    jupiterMoney.CAREER_PORTAL_INFO_URL,
    'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(jupiterMoney.VERIFIED_ON, '2026-07-16')
  assert.equal(jupiterMoney.extractOfficialKekaUrl(officialContactHtml), 'https://jupiter.keka.com/careers')
  assert.equal(jupiterMoney.hasOfficialJupiterMoneyCareersSignals(officialContactHtml), true)
  assert.equal(
    jupiterMoney.hasOfficialJupiterMoneyCareersSignals('<html><head><title>Contact</title></head><body><h1>Contact us</h1></body></html>'),
    false,
  )
  assert.equal(
    jupiterMoney.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/b5279857-cf81-4dde-a215-fc48957ee2b5/careerportal/18096d20247d4ecfa4efcf04875cbda6.html',
  )
  assert.deepEqual(jupiterMoney.extractCareerConfig(embeddedCareersHtml), {
    identifier: 'b5279857-cf81-4dde-a215-fc48957ee2b5',
    domain: 'https://jupiter.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    jupiterMoney.buildCareerPortalInfoUrl({ domain: 'https://jupiter.keka.com/careers/' }),
    'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    jupiterMoney.buildActiveJobsUrl({
      domain: 'https://jupiter.keka.com/careers/',
      identifier: 'b5279857-cf81-4dde-a215-fc48957ee2b5',
    }),
    'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5',
  )
  assert.equal(jupiterMoney.hasExpectedPortalIdentity(portalInfoPayload), true)
  assert.equal(
    jupiterMoney.hasExpectedPortalIdentity({ ...portalInfoPayload, careersPortalDomain: 'example.keka.com' }),
    false,
  )
})

test('extractSearchResults maps live-shaped Jupiter Money Keka payloads including missing-location fallbacks', async () => {
  const jupiterMoney = await loadJupiterMoneyModule()

  assert.deepEqual(
    jupiterMoney.extractSearchResults(activeJobsPayload, { domain: 'https://jupiter.keka.com/careers/' }),
    [
      {
        title: 'Devops Engineer - SDE 2',
        company: 'Jupiter Money',
        department: 'Engineering',
        location: 'Bengaluru, KA, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '134831',
        requisitionId: '134831',
        sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134831',
        applyUrl: 'https://jupiter.keka.com/careers/jobdetails/134831',
        employmentType: 'Full Time',
        experienceRequired: '3-5',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-15',
        closingDate: null,
        jobDescription: 'Build secure and scalable AWS infrastructure.',
      },
      {
        title: 'Hr Operations Lead',
        company: 'Jupiter Money',
        department: 'HR Operation',
        location: 'India',
        city: null,
        country: 'India',
        jobId: '134239',
        requisitionId: '134239',
        sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134239',
        applyUrl: 'https://jupiter.keka.com/careers/jobdetails/134239',
        employmentType: 'Full Time',
        experienceRequired: '5-8 Years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['operations', 'communication skills', 'PAYROLL'],
        postingDate: '2026-07-08',
        closingDate: null,
        jobDescription: 'Own and drive the end-to-end employee lifecycle.',
      },
    ],
  )
})

test('run validates the official Jupiter Money handoff, the Keka portal identity, and returns normalized jobs', async () => {
  const jupiterMoney = await loadJupiterMoneyModule()
  const requestedUrls = []

  const jobs = await jupiterMoney.createJupiterMoneyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push({ type: 'text', url })
      if (url === jupiterMoney.OFFICIAL_CAREERS_URL) return officialContactHtml
      if (url === jupiterMoney.EXTERNAL_HANDOFF_URL) return kekaShellHtml
      if (url === 'https://jupiter.keka.com/ats/documents/b5279857-cf81-4dde-a215-fc48957ee2b5/careerportal/18096d20247d4ecfa4efcf04875cbda6.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected Jupiter Money text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push({ type: 'json', url })
      if (url === jupiterMoney.CAREER_PORTAL_INFO_URL) return portalInfoPayload
      if (url === 'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5') {
        return activeJobsPayload
      }
      throw new Error(`Unexpected Jupiter Money JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    { type: 'text', url: jupiterMoney.OFFICIAL_CAREERS_URL },
    { type: 'text', url: jupiterMoney.EXTERNAL_HANDOFF_URL },
    {
      type: 'text',
      url: 'https://jupiter.keka.com/ats/documents/b5279857-cf81-4dde-a215-fc48957ee2b5/careerportal/18096d20247d4ecfa4efcf04875cbda6.html',
    },
    { type: 'json', url: jupiterMoney.CAREER_PORTAL_INFO_URL },
    {
      type: 'json',
      url: 'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5',
    },
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Devops Engineer - SDE 2',
      company: 'Jupiter Money',
      department: 'Engineering',
      location: 'Bengaluru, KA, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '134831',
      requisitionId: '134831',
      sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134831',
      applyUrl: 'https://jupiter.keka.com/careers/jobdetails/134831',
      employmentType: 'Full Time',
      experienceRequired: '3-5',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15',
      closingDate: null,
      jobDescription: 'Build secure and scalable AWS infrastructure.',
      source: 'jupitermoney',
      link: 'https://jupiter.keka.com/careers/jobdetails/134831',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Hr Operations Lead',
      company: 'Jupiter Money',
      department: 'HR Operation',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '134239',
      requisitionId: '134239',
      sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134239',
      applyUrl: 'https://jupiter.keka.com/careers/jobdetails/134239',
      employmentType: 'Full Time',
      experienceRequired: '5-8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['operations', 'communication skills', 'PAYROLL'],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription: 'Own and drive the end-to-end employee lifecycle.',
      source: 'jupitermoney',
      link: 'https://jupiter.keka.com/careers/jobdetails/134239',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Jupiter Money fails closed when the first-party handoff or Keka portal identity drifts', async () => {
  const jupiterMoney = await loadJupiterMoneyModule()

  await assert.rejects(
    jupiterMoney.createJupiterMoneyScraper().run({
      fetchText: async (url) => {
        if (url === jupiterMoney.OFFICIAL_CAREERS_URL) {
          return '<html><head><title>Contact</title></head><body><h1>Contact us</h1></body></html>'
        }
        if (url === jupiterMoney.EXTERNAL_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === jupiterMoney.CAREER_PORTAL_INFO_URL) return portalInfoPayload
        return activeJobsPayload
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    jupiterMoney.createJupiterMoneyScraper().run({
      fetchText: async (url) => {
        if (url === jupiterMoney.OFFICIAL_CAREERS_URL) return officialContactHtml
        if (url === jupiterMoney.EXTERNAL_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === jupiterMoney.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfoPayload, careersPortalDomain: 'example.keka.com' }
        }
        return activeJobsPayload
      },
    }),
    /exact company identity/i,
  )
})
