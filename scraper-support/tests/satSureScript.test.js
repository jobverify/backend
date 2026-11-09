import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>SatSure Careers | Build the Future of Earth Intelligence</title>
  </head>
  <body>
    <main>
      <section>
        <h2>Think Bold To Soar High</h2>
        <p>Let&#8217;s Solve for Earth from Space</p>
        <a href="https://satsure.keka.com/careers">View Open Positions</a>
      </section>
      <footer>
        <p>SatSure Analytics India Pvt Ltd</p>
      </footer>
    </main>
  </body>
</html>
`

const KEKA_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <div id="app"></div>
    <script>
      fetch('/ats/documents/350ad025-b87c-4c10-940f-8f95377d5133/careerportal/6941ed74c483404bb400f4ee5c60cca9.html')
    </script>
  </body>
</html>
`

const EMBEDDED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      window.khConfig = {
        identifier: '350ad025-b87c-4c10-940f-8f95377d5133',
        domain: 'https://satsure.keka.com/careers/',
        targetContainer: '#khembedjobs'
      };
    </script>
    <script src="https://satsure.keka.com/careers/api/embedjobs/js/350ad025-b87c-4c10-940f-8f95377d5133"></script>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const PORTAL_INFO = {
  name: 'SatSure Analytics India',
  shortName: 'SatSure Analytics India',
  careersPortalDomain: 'satsure.keka.com',
}

const ACTIVE_JOBS_PAYLOAD = [
  {
    id: 153475,
    jobNumber: '2024253',
    title: 'Software Development Engineer - 2',
    departmentName: 'Engineering',
    jobType: 2,
    publishedOn: '2026-07-27T15:10:48.113Z',
    experience: '3 - 6',
    description: '<div>Build backend services for Earth intelligence products.</div>',
    jobLocations: [
      {
        id: 10662,
        name: 'Bangalore',
        city: 'Bangalore',
        state: '',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    skillNames: ['Node.js', 'PostgreSQL'],
  },
  {
    id: 153042,
    jobNumber: '2024251',
    title: 'Machine Learning Engineer - 2',
    departmentName: 'EO DS',
    jobType: 2,
    publishedOn: '2026-07-24T09:11:04.603Z',
    experience: '4 - 7',
    description: '<div>SatSure is a global Earth intelligence company headquartered in India.</div>',
    jobLocations: [],
    skillNames: ['Python', 'MLOps'],
  },
  {
    id: 999001,
    jobNumber: 'US-OPENING',
    title: 'US-only role',
    departmentName: 'Sales',
    jobType: 2,
    publishedOn: '2026-07-20T00:00:00.000Z',
    description: '<div>Outside the India filter.</div>',
    jobLocations: [
      {
        name: 'Austin',
        city: 'Austin',
        state: 'TX',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/satsure/script.js')
  } catch {
    assert.fail('Expected SatSure scraper module at ../../scraper/satsure/script.js')
  }
}

test('SatSure scraper helpers stay pinned to the verified first-party careers page and public Keka board contract', async () => {
  const satSure = await loadModule()

  assert.equal(satSure.SOURCE, 'satsure')
  assert.equal(satSure.COMPANY, 'SatSure')
  assert.equal(satSure.OFFICIAL_BRAND_NAME, 'SatSure Analytics India Pvt Ltd')
  assert.equal(satSure.VERIFIED_ON, '2026-08-04')
  assert.equal(satSure.CAREERS_PAGE_URL, 'https://www.satsure.co/careers/')
  assert.equal(satSure.OFFICIAL_CAREERS_HANDOFF_URL, 'https://satsure.keka.com/careers')
  assert.equal(satSure.KEKA_BOARD_URL, 'https://satsure.keka.com/careers')
  assert.equal(
    satSure.CAREER_PORTAL_INFO_URL,
    'https://satsure.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    satSure.ACTIVE_JOBS_URL,
    'https://satsure.keka.com/careers/api/embedjobs/default/active/350ad025-b87c-4c10-940f-8f95377d5133',
  )
  assert.equal(satSure.VERIFIED_SAMPLE_JOB_URL, 'https://satsure.keka.com/careers/jobdetails/153475')
  assert.match(satSure.VERIFIED_SURFACE_SUMMARY, /25 live public openings/i)
  assert.equal(satSure.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    satSure.extractOfficialKekaHandoffUrl(OFFICIAL_CAREERS_HTML),
    'https://satsure.keka.com/careers',
  )
  assert.equal(
    satSure.extractEmbeddedCareersDocumentPath(KEKA_SHELL_HTML),
    '/ats/documents/350ad025-b87c-4c10-940f-8f95377d5133/careerportal/6941ed74c483404bb400f4ee5c60cca9.html',
  )
  assert.deepEqual(
    satSure.extractCareerConfig(EMBEDDED_CAREERS_HTML),
    {
      identifier: '350ad025-b87c-4c10-940f-8f95377d5133',
      domain: 'https://satsure.keka.com/careers/',
      portalName: 'default',
    },
  )
  assert.equal(
    satSure.buildCareerPortalInfoUrl({ domain: 'https://satsure.keka.com/careers/', portalName: 'default' }),
    'https://satsure.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    satSure.buildActiveJobsUrl({
      domain: 'https://satsure.keka.com/careers/',
      identifier: '350ad025-b87c-4c10-940f-8f95377d5133',
      portalName: 'default',
    }),
    'https://satsure.keka.com/careers/api/embedjobs/default/active/350ad025-b87c-4c10-940f-8f95377d5133',
  )
  assert.equal(satSure.hasExpectedPortalIdentity(PORTAL_INFO), true)

  const jobs = satSure.extractSearchResults(ACTIVE_JOBS_PAYLOAD, {
    domain: 'https://satsure.keka.com/careers/',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Software Development Engineer - 2',
    company: 'SatSure',
    department: 'Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    state: null,
    country: 'India',
    jobId: '153475',
    requisitionId: '2024253',
    sourceUrl: 'https://satsure.keka.com/careers/jobdetails/153475',
    applyUrl: 'https://satsure.keka.com/careers/applyjob/153475',
    employmentType: 'Full Time',
    experienceRequired: '3 - 6',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Node.js', 'PostgreSQL'],
    postingDate: '2026-07-27',
    closingDate: null,
    jobDescription: 'Build backend services for Earth intelligence products.',
  })
  assert.equal(jobs[1].title, 'Machine Learning Engineer - 2')
  assert.equal(jobs[1].location, null)
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].state, null)
  assert.equal(jobs[1].country, null)
  assert.equal(jobs[1].applyUrl, 'https://satsure.keka.com/careers/applyjob/153042')
})

test('SatSure scraper retains India and country-unknown observations from the verified Keka embed feed', async () => {
  const satSure = await loadModule()
  const requestedUrls = []

  const jobs = await satSure.createSatSureScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === satSure.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML
      if (url === satSure.OFFICIAL_CAREERS_HANDOFF_URL) return KEKA_SHELL_HTML
      if (url === 'https://satsure.keka.com/ats/documents/350ad025-b87c-4c10-940f-8f95377d5133/careerportal/6941ed74c483404bb400f4ee5c60cca9.html') {
        return EMBEDDED_CAREERS_HTML
      }

      throw new Error(`Unexpected SatSure text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === satSure.CAREER_PORTAL_INFO_URL) return PORTAL_INFO
      if (url === satSure.ACTIVE_JOBS_URL) return ACTIVE_JOBS_PAYLOAD

      throw new Error(`Unexpected SatSure JSON URL: ${url}`)
    },
    now: () => '2026-08-04T11:22:33.000Z',
  })

  assert.deepEqual(requestedUrls, [
    satSure.CAREERS_PAGE_URL,
    satSure.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://satsure.keka.com/ats/documents/350ad025-b87c-4c10-940f-8f95377d5133/careerportal/6941ed74c483404bb400f4ee5c60cca9.html',
    satSure.CAREER_PORTAL_INFO_URL,
    satSure.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'satsure')
  assert.equal(jobs[0].link, 'https://satsure.keka.com/careers/applyjob/153475')
  assert.equal(jobs[0].companyCareerPage, 'https://www.satsure.co/careers/')
  assert.equal(jobs[0].companyDomain, 'satsure.co')
  assert.equal(jobs[0].atsPlatform, 'keka-embed-api')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T11:22:33.000Z')
  assert.equal(jobs[1].title, 'Machine Learning Engineer - 2')
  assert.equal(jobs[1].country, null)
})

test('SatSure scraper fails closed when the verified first-party page or Keka identity drifts materially', async () => {
  const satSure = await loadModule()

  await assert.rejects(
    satSure.createSatSureScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified satsure careers page/i,
  )

  await assert.rejects(
    satSure.createSatSureScraper().run({
      fetchText: async (url) => {
        if (url === satSure.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML
        if (url === satSure.OFFICIAL_CAREERS_HANDOFF_URL) return KEKA_SHELL_HTML
        return EMBEDDED_CAREERS_HTML
      },
      fetchJson: async (url) => {
        if (url === satSure.CAREER_PORTAL_INFO_URL) {
          return { ...PORTAL_INFO, careersPortalDomain: 'example.keka.com' }
        }

        if (url === satSure.ACTIVE_JOBS_URL) return ACTIVE_JOBS_PAYLOAD

        throw new Error(`Unexpected SatSure JSON URL: ${url}`)
      },
    }),
    /exact company identity/i,
  )
})
