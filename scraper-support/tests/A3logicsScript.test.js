import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/a3logics/script.js')
  } catch {
    assert.fail('Expected A3logics scraper module at ../../scraper/a3logics/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>A3Logics Careers & Job Opportunities</title>
  </head>
  <body>
    <h1>A3Logics Careers & Job Opportunities</h1>
    <a href="https://a3logics.keka.com/careers/">Explore Job opportunities</a>
    <div id="khembedjobs"></div>
    <script>
      window.khConfig = {
        domain: 'https://a3logics.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://a3logics.keka.com/careers/api/embedjobs/js/7061a4dc-4cd0-4c44-ab72-df4368cc7199"></script>
  </body>
</html>
`

const kekaBootstrapHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      fetch('/ats/documents/7061a4dc-4cd0-4c44-ab72-df4368cc7199/careerportal/a3logics-careers.html')
    </script>
  </body>
</html>
`

const embeddedCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      window.khConfig = {
        identifier: '7061a4dc-4cd0-4c44-ab72-df4368cc7199',
        domain: 'https://a3logics.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://a3logics.keka.com/careers/api/embedjobs/js/7061a4dc-4cd0-4c44-ab72-df4368cc7199" defer></script>
    <h2>Open positions</h2>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: 'A3LOGICS',
  shortName: 'A3LOGICS',
  careersPortalDomain: 'a3logics.keka.com',
  companyWebsite: 'https://www.a3logics.com/',
  companyWebsite: 'https://www.a3logics.com/',
}

test('A3logics constants stay pinned to the verified first-party careers and Keka surfaces', async () => {
  const a3logics = await loadModule()

  assert.equal(a3logics.SOURCE, 'a3logics')
  assert.equal(a3logics.COMPANY, 'A3logics')
  assert.equal(a3logics.CAREERS_URL, 'https://www.a3logics.com/careers/')
  assert.equal(a3logics.KEKA_BOARD_URL, 'https://a3logics.keka.com/careers/')
  assert.equal(a3logics.EXPECTED_IDENTIFIER, '7061a4dc-4cd0-4c44-ab72-df4368cc7199')
  assert.equal(a3logics.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(a3logics.hasOfficialCareersSignal(careersPageHtml.replace(/<script src="https:\/\/a3logics\.keka\.com\/careers\/api\/embedjobs\/js\/[^\"]+"><\/script>/, '')), true)
  assert.equal(
    a3logics.extractEmbeddedCareersDocumentPath(kekaBootstrapHtml),
    '/ats/documents/7061a4dc-4cd0-4c44-ab72-df4368cc7199/careerportal/a3logics-careers.html',
  )
  assert.deepEqual(a3logics.extractCareerConfig(embeddedCareersHtml), {
    identifier: '7061a4dc-4cd0-4c44-ab72-df4368cc7199',
    domain: 'https://a3logics.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(a3logics.hasExpectedPortalIdentity(portalInfo), true)
})

test('A3logics keeps only India jobs from the verified Keka payload', async () => {
  const a3logics = await loadModule()

  const jobs = a3logics.extractSearchResults(
    [
      {
        id: 78232,
        title: 'Data Administrator',
        description: '<div>Research, collect, organize, and maintain large sets of business and market data.</div>',
        departmentName: 'EDI',
        jobLocations: [
          {
            name: 'Head Office',
            city: 'Jaipur',
            state: 'RJ',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '0-1',
        publishedOn: '2026-07-01T09:14:48.173Z',
        skillNames: [],
      },
      {
        id: 99999,
        title: 'US Delivery Lead',
        description: '<div>Should be filtered out.</div>',
        departmentName: 'Delivery',
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
    ],
    {
      domain: 'https://a3logics.keka.com/careers/',
    },
  )

  assert.deepEqual(jobs, [
    {
      title: 'Data Administrator',
      company: 'A3logics',
      department: 'EDI',
      location: 'Jaipur, RJ, India',
      city: 'Jaipur',
      state: 'RJ',
      country: 'India',
      jobId: '78232',
      requisitionId: '78232',
      sourceUrl: 'https://a3logics.keka.com/careers/jobdetails/78232',
      applyUrl: 'https://a3logics.keka.com/careers/applyjob/78232',
      employmentType: 'Full Time',
      experienceRequired: '0-1',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01',
      closingDate: null,
      jobDescription: 'Research, collect, organize, and maintain large sets of business and market data.',
    },
  ])
})

test('A3logics run validates the verified handoff and decorates jobs', async () => {
  const a3logics = await loadModule()

  const requestedTexts = []
  const requestedJson = []
  const jobs = await a3logics.createA3logicsScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === a3logics.CAREERS_URL) return careersPageHtml
      if (url === a3logics.KEKA_BOARD_URL) return kekaBootstrapHtml
      if (url === 'https://a3logics.keka.com/ats/documents/7061a4dc-4cd0-4c44-ab72-df4368cc7199/careerportal/a3logics-careers.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://a3logics.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://a3logics.keka.com/careers/api/embedjobs/default/active/7061a4dc-4cd0-4c44-ab72-df4368cc7199') {
        return [
          {
            id: 74108,
            title: 'Senior System Administrator',
            description: '<div>Manage and maintain network infrastructure and security operations.</div>',
            departmentName: 'IT',
            jobLocations: [
              {
                name: 'Head Office',
                city: 'Jaipur',
                state: 'RJ',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '5-7 years',
            publishedOn: '2026-06-02T06:39:06.197Z',
            skillNames: ['Cisco', 'SonicWall'],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    'https://www.a3logics.com/careers/',
    'https://a3logics.keka.com/careers/',
    'https://a3logics.keka.com/ats/documents/7061a4dc-4cd0-4c44-ab72-df4368cc7199/careerportal/a3logics-careers.html',
  ])
  assert.deepEqual(requestedJson, [
    'https://a3logics.keka.com/careers/api/organization/default/careerportalinfo',
    'https://a3logics.keka.com/careers/api/embedjobs/default/active/7061a4dc-4cd0-4c44-ab72-df4368cc7199',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior System Administrator')
  assert.equal(jobs[0].source, 'a3logics')
  assert.equal(jobs[0].companyDomain, 'a3logics.com')
  assert.equal(jobs[0].link, 'https://a3logics.keka.com/careers/applyjob/74108')
})

test('A3logics fails closed when the verified first-party or Keka identity changes', async () => {
  const a3logics = await loadModule()

  await assert.rejects(
    a3logics.createA3logicsScraper().run({
      fetchText: async () => '<html><body>No verified handoff</body></html>',
      fetchJson: async () => portalInfo,
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    a3logics.createA3logicsScraper().run({
      fetchText: async (url) => {
        if (url === a3logics.CAREERS_URL) return careersPageHtml
        if (url === a3logics.KEKA_BOARD_URL) return kekaBootstrapHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url.includes('careerportalinfo')) {
          return { ...portalInfo, name: 'Different Company' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})

test('A3logics uses its exact Keka tenant when the official careers page returns 403', async () => {
  const a3logics = await loadModule()
  const jobs = await a3logics.createA3logicsScraper().run({
    fetchText: async (url) => {
      if (url === a3logics.CAREERS_URL) return '<html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>'
      if (url === a3logics.KEKA_BOARD_URL) return kekaBootstrapHtml
      return embeddedCareersHtml
    },
    fetchJson: async (url) => url.includes('careerportalinfo') ? portalInfo : [{
      id: 90399,
      title: 'Senior System and Network Administrator',
      jobLocations: [{ city: 'Jaipur', countryCode: 'IN' }],
    }],
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior System and Network Administrator')
  assert.equal(jobs[0].source, 'a3logics')
})
