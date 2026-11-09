import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>nference | Careers</title>
  </head>
  <body>
    <main>
      <button>nference Global</button>
      <button>nference India</button>
      <section>
        <p>Innovate with us</p>
        <p>Join us to unlock the insights within biomedical and healthcare data.</p>
      </section>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "content": [
                {
                  "data": {
                    "slices": [
                      {
                        "slice_type": "careers_hero_titles",
                        "primary": {
                          "title": [{ "text": "Make an Impact" }],
                          "description": [{ "text": "Join us! We are dedicated to unearthing advanced AI-based solutions in healthcare diagnostics and therapeutics." }],
                          "linkCTA": {
                            "url": "https://nference.keka.com/careers",
                            "target": "_blank"
                          },
                          "isGlobal": false
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      </script>
    </main>
  </body>
</html>
`

const kekaShellHtml = `
<!doctype html>
<html>
  <body>
    <div id="content-container"></div>
    <script>
      fetch('/ats/documents/ebcb8808-c268-4a6d-a493-192d50dde0b7/careerportal/5d2d92b5a3784b2aa8f30f3c3442143d.html')
        .then(response => response.text())
    </script>
  </body>
</html>
`

const embeddedCareersHtml = `
<!doctype html>
<html>
  <head>
    <script>
      window.khConfig = {
        identifier: 'ebcb8808-c268-4a6d-a493-192d50dde0b7',
        domain: 'https://nference.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://nference.keka.com/careers/api/embedjobs/js/ebcb8808-c268-4a6d-a493-192d50dde0b7" defer></script>
  </head>
  <body>
    <h2>Open Positions</h2>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: 'Nference',
  shortName: 'Nference',
  careersPortalDomain: 'nference.keka.com',
  companyWebsite: '',
}

const activeJobsPayload = [
  {
    id: 78858,
    title: 'Technical Operations Engineer',
    description: '<div>Own production support, observability, and cloud operations for the platform.</div>',
    departmentName: 'TechOps',
    jobLocations: [
      {
        name: 'Bangalore',
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '1-4 years',
    publishedOn: '2026-07-06T11:46:23.22Z',
    skillNames: ['Linux', 'AWS'],
  },
  {
    id: 70213,
    title: 'Senior Software Engineer - Backend',
    description: '<div>Build backend systems that power healthcare research workflows.</div>',
    departmentName: 'Development',
    jobLocations: [
      {
        name: 'Bangalore',
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '4 - 7 years',
    publishedOn: '2026-05-05T07:11:38.167Z',
    skillNames: ['Node.js', 'PostgreSQL'],
  },
  {
    id: 68521,
    title: 'Associate Product Manager',
    description: '<div>Drive roadmap execution for AI-first product surfaces.</div>',
    departmentName: 'Product Management',
    jobLocations: [
      {
        name: 'Bangalore',
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '3 years',
    publishedOn: '2026-06-23T07:54:11.233Z',
    skillNames: ['Roadmapping'],
  },
]

const loadNferenceModule = async () => {
  try {
    return await import('../../scraper/nference/script.js')
  } catch {
    assert.fail('Expected Nference scraper module at ../../scraper/nference/script.js')
  }
}

test('Nference pins the verified first-party careers page and public Keka handoff contract', async () => {
  const nference = await loadNferenceModule()

  assert.equal(nference.SOURCE, 'nference')
  assert.equal(nference.COMPANY_NAME, 'Nference')
  assert.equal(nference.OFFICIAL_BRAND_NAME, 'nference')
  assert.equal(nference.CAREERS_URL, 'https://nference.com/careers')
  assert.equal(nference.OFFICIAL_CAREERS_HANDOFF_URL, 'https://nference.keka.com/careers/')
  assert.equal(
    nference.CAREER_PORTAL_INFO_URL,
    'https://nference.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    nference.ACTIVE_JOBS_URL,
    'https://nference.keka.com/careers/api/embedjobs/default/active/ebcb8808-c268-4a6d-a493-192d50dde0b7',
  )
  assert.equal(nference.EXPECTED_IDENTIFIER, 'ebcb8808-c268-4a6d-a493-192d50dde0b7')
  assert.equal(nference.EXPECTED_KEKA_DOMAIN, 'https://nference.keka.com/careers/')
  assert.equal(nference.EXPECTED_PORTAL_NAME, 'default')
  assert.equal(nference.VERIFIED_ON, '2026-07-16')
  assert.equal(nference.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    nference.extractOfficialKekaHandoffUrl(officialCareersHtml),
    'https://nference.keka.com/careers/',
  )
  assert.equal(
    nference.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/ebcb8808-c268-4a6d-a493-192d50dde0b7/careerportal/5d2d92b5a3784b2aa8f30f3c3442143d.html',
  )
  assert.deepEqual(nference.extractCareerConfig(embeddedCareersHtml), {
    identifier: 'ebcb8808-c268-4a6d-a493-192d50dde0b7',
    domain: 'https://nference.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    nference.buildCareerPortalInfoUrl(nference.extractCareerConfig(embeddedCareersHtml)),
    'https://nference.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    nference.buildActiveJobsUrl(nference.extractCareerConfig(embeddedCareersHtml)),
    'https://nference.keka.com/careers/api/embedjobs/default/active/ebcb8808-c268-4a6d-a493-192d50dde0b7',
  )
  assert.equal(nference.hasExpectedPortalIdentity(portalInfo), true)
})

test('Nference extracts the verified Keka payload into shared scraper job fields', async () => {
  const nference = await loadNferenceModule()

  const jobs = nference.extractSearchResults(activeJobsPayload, {
    domain: 'https://nference.keka.com/careers/',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Technical Operations Engineer',
    company: 'Nference',
    department: 'TechOps',
    location: 'Bangalore, KA, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '78858',
    requisitionId: '78858',
    sourceUrl: 'https://nference.keka.com/careers/jobdetails/78858',
    applyUrl: 'https://nference.keka.com/careers/applyjob/78858',
    employmentType: 'Full Time',
    experienceRequired: '1-4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Linux', 'AWS'],
    postingDate: '2026-07-06',
    closingDate: null,
    jobDescription: 'Own production support, observability, and cloud operations for the platform.',
  })
  assert.equal(jobs[1].title, 'Senior Software Engineer - Backend')
  assert.equal(jobs[2].title, 'Associate Product Manager')
})

test('Nference run validates the first-party careers page, Keka portal, and decorates active jobs', async () => {
  const nference = await loadNferenceModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await nference.createNferenceScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === nference.CAREERS_URL) return officialCareersHtml
      if (url === nference.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
      if (url === 'https://nference.keka.com/ats/documents/ebcb8808-c268-4a6d-a493-192d50dde0b7/careerportal/5d2d92b5a3784b2aa8f30f3c3442143d.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected Nference text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === nference.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === nference.ACTIVE_JOBS_URL) return activeJobsPayload
      throw new Error(`Unexpected Nference JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTexts, [
    nference.CAREERS_URL,
    nference.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://nference.keka.com/ats/documents/ebcb8808-c268-4a6d-a493-192d50dde0b7/careerportal/5d2d92b5a3784b2aa8f30f3c3442143d.html',
  ])
  assert.deepEqual(requestedJson, [
    nference.CAREER_PORTAL_INFO_URL,
    nference.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'nference')
  assert.equal(jobs[0].company, 'Nference')
  assert.equal(jobs[0].link, 'https://nference.keka.com/careers/applyjob/78858')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Nference fails closed when the first-party careers page or Keka portal identity drifts materially', async () => {
  const nference = await loadNferenceModule()

  await assert.rejects(
    nference.createNferenceScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected Careers Page</h1></body></html>',
      fetchJson: async () => activeJobsPayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    nference.createNferenceScraper().run({
      fetchText: async (url) => {
        if (url === nference.CAREERS_URL) return officialCareersHtml
        if (url === nference.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml.replace(
          'ebcb8808-c268-4a6d-a493-192d50dde0b7',
          '11111111-2222-3333-4444-555555555555',
        )
      },
      fetchJson: async () => portalInfo,
    }),
    /verified keka/i,
  )

  await assert.rejects(
    nference.createNferenceScraper().run({
      fetchText: async (url) => {
        if (url === nference.CAREERS_URL) return officialCareersHtml
        if (url === nference.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === nference.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfo, name: 'Different Company' }
        }
        return activeJobsPayload
      },
    }),
    /company identity/i,
  )
})
