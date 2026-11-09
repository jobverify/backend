import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/zluri/script.js')
  } catch {
    assert.fail('Expected Zluri scraper module at ../../scraper/zluri/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Zluri</title>
    <link rel="canonical" href="https://www.zluri.com/careers" />
  </head>
  <body>
    <main>
      <section>
        <h1>Blaze your trail at Zluri</h1>
        <p>Excellence isn’t just our product promise - it’s our promise to you.</p>
        <a href="#opportunities">Explore Opportunities →</a>
      </section>
      <section>
        <h2>Why join Zluri</h2>
        <p>Put Customers First.</p>
        <p>Own What You Do.</p>
        <p>Deliver Results.</p>
        <p>Maintain a Bias for Action.</p>
        <p>Hire and Develop the Best.</p>
      </section>
      <section>
        <div id="opportunities">
          <h2>Open Roles</h2>
          <script>
            window.khConfig = {
              identifier: 'ed2b6b25-be74-43f1-9a38-c3bf27b9146c',
              domain: 'https://zluri.keka.com/careers/',
              targetContainer: '#khembedjobs',
            }
          </script>
          <script
            src="https://zluri.keka.com/careers/api/embedjobs/js/ed2b6b25-be74-43f1-9a38-c3bf27b9146c"
            defer
          ></script>
          <div id="khembedjobs"></div>
        </div>
      </section>
    </main>
  </body>
</html>
`

const portalInfo = {
  name: 'Zluri',
  shortName: 'Zluri',
  careersPortalDomain: 'zluri.keka.com',
  companyWebsite: '',
}

test('Zluri validates the verified first-party careers page, embedded Keka config, and portal identity', async () => {
  const zluri = await loadModule()

  assert.equal(zluri.SOURCE, 'zluri')
  assert.equal(zluri.COMPANY, 'Zluri')
  assert.equal(zluri.OFFICIAL_BRAND, 'Zluri')
  assert.equal(zluri.VERIFIED_ON, '2026-08-02')
  assert.equal(zluri.CAREERS_URL, 'https://www.zluri.com/careers')
  assert.equal(zluri.KEKA_BOARD_URL, 'https://zluri.keka.com/careers/')
  assert.equal(zluri.EXPECTED_KEKA_IDENTIFIER, 'ed2b6b25-be74-43f1-9a38-c3bf27b9146c')
  assert.equal(zluri.EXPECTED_KEKA_DOMAIN, 'zluri.keka.com')
  assert.equal(
    zluri.CAREER_PORTAL_INFO_URL,
    'https://zluri.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    zluri.ACTIVE_JOBS_URL,
    'https://zluri.keka.com/careers/api/embedjobs/default/active/ed2b6b25-be74-43f1-9a38-c3bf27b9146c',
  )
  assert.match(zluri.VERIFIED_SURFACE_SUMMARY, /Sunday, August 2, 2026/)
  assert.equal(zluri.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(zluri.extractEmbeddedKekaConfig(careersHtml), {
    identifier: 'ed2b6b25-be74-43f1-9a38-c3bf27b9146c',
    domain: 'https://zluri.keka.com/careers/',
    targetContainer: '#khembedjobs',
  })
  assert.equal(zluri.hasExpectedPortalIdentity(portalInfo), true)
})

test('Zluri keeps only India jobs from the verified Keka payload and maps them to the shared shape', async () => {
  const zluri = await loadModule()

  const jobs = zluri.extractKekaJobs(
    [
      {
        id: 80996,
        title: 'Senior Product Manager',
        description:
          '<div><strong>Senior Product Manager</strong></div><div>About Zluri: Securing the AI Future</div>',
        departmentName: 'Product & Design',
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
        experience: '4-7 years',
        publishedOn: '2026-07-21T11:18:51.11Z',
        skillNames: [],
      },
      {
        id: 999001,
        title: 'Outside India Role',
        description: '<div>Outside India role.</div>',
        departmentName: 'Sales',
        jobLocations: [
          {
            name: 'San Francisco',
            city: 'San Francisco',
            state: 'CA',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
        jobType: 2,
      },
    ],
    {
      domain: 'https://zluri.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Product Manager',
    company: 'Zluri',
    department: 'Product & Design',
    location: 'Bangalore, KA, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '80996',
    requisitionId: '80996',
    sourceUrl: 'https://zluri.keka.com/careers/jobdetails/80996',
    applyUrl: 'https://zluri.keka.com/careers/applyjob/80996',
    employmentType: 'Full Time',
    experienceRequired: '4-7 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-21',
    closingDate: null,
    jobDescription: 'Senior Product Manager About Zluri: Securing the AI Future',
  })
})

test('Zluri run validates the official careers surface, portal identity, and embedded public jobs payload', async () => {
  const zluri = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await zluri.createZluriScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === zluri.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === zluri.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === zluri.ACTIVE_JOBS_URL) {
        return [
          {
            id: 79171,
            title: 'Customer Solutions Engineer',
            description: '<div>About Us:</div><div>Zluri</div>',
            departmentName: 'Customer Success',
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
            experience: '3-5 years',
            publishedOn: '2026-07-22T09:00:00.000Z',
            skillNames: [],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [zluri.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    zluri.CAREER_PORTAL_INFO_URL,
    zluri.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'zluri')
  assert.equal(jobs[0].company, 'Zluri')
  assert.equal(jobs[0].link, 'https://zluri.keka.com/careers/applyjob/79171')
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')
})

test('Zluri fails closed when the verified careers surface, embedded Keka config, or portal identity changes', async () => {
  const zluri = await loadModule()

  await assert.rejects(
    zluri.createZluriScraper().run({
      fetchText: async () =>
        careersHtml.replace('https://zluri.keka.com/careers/', 'https://example.com/jobs/'),
      fetchJson: async () => portalInfo,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    zluri.createZluriScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async (url) => {
        if (url === zluri.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfo, careersPortalDomain: 'example.keka.com' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
