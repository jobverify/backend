import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/taazaa/script.js')
  } catch {
    assert.fail('Expected TAAZAA scraper module at ../../scraper/taazaa/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineering &amp; AI Jobs at Taazaa | Open Positions</title>
  </head>
  <body>
    <h2>Current Openings</h2>
    <a href="#openings">View All Openings</a>
    <script>
      window.khConfig = {
        identifier: 'caf439a8-817a-46f5-917f-c6aef6ab6beb',
        domain: 'https://taazaa.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <a href="mailto:hr@taazaa.com">hr@taazaa.com</a>
  </body>
</html>
`

const portalInfo = {
  name: 'Taazaa ',
  shortName: 'Taazaa ',
  careersPortalDomain: 'taazaa.keka.com',
}

test('TAAZAA validates the verified first-party careers page and embedded Keka configuration', async () => {
  const taazaa = await loadModule()

  assert.equal(taazaa.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(taazaa.extractCareerConfig(careersHtml), {
    identifier: 'caf439a8-817a-46f5-917f-c6aef6ab6beb',
    domain: 'https://taazaa.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(taazaa.hasExpectedPortalIdentity(portalInfo), true)
})

test('TAAZAA keeps only India jobs from the verified Keka payload and maps them to the shared shape', async () => {
  const taazaa = await loadModule()

  const jobs = taazaa.extractSearchResults(
    [
      {
        id: 134308,
        title: 'AEM Guides Developer',
        description: '<div>Join our Engineering team in Noida/Pune.</div>',
        departmentName: 'Adobe Experience Manager',
        jobLocations: [
          {
            name: 'Noida',
            city: 'Noida',
            state: 'UP',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '5-7',
        jobNumber: 'TZ_303',
        publishedOn: '2026-07-09T09:24:14.463Z',
        skillNames: ['Java', 'AEM'],
      },
      {
        id: 999999,
        title: 'US Role',
        description: '<div>Outside India.</div>',
        departmentName: 'Sales',
        jobLocations: [
          {
            name: 'Austin',
            city: 'Austin',
            state: 'TX',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
        jobType: 2,
      },
    ],
    {
      domain: 'https://taazaa.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'AEM Guides Developer',
    company: 'TAAZAA',
    department: 'Adobe Experience Manager',
    location: 'Noida, UP, India',
    city: 'Noida',
    country: 'India',
    jobId: '134308',
    requisitionId: 'TZ_303',
    sourceUrl: 'https://taazaa.keka.com/careers/jobdetails/134308',
    applyUrl: 'https://taazaa.keka.com/careers/applyjob/134308',
    employmentType: 'Full Time',
    experienceRequired: '5-7',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Java', 'AEM'],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Join our Engineering team in Noida/Pune.',
  })
})

test('TAAZAA run validates the first-party embedded Keka handoff, exact portal identity, and decorates India jobs', async () => {
  const taazaa = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await taazaa.createTaazaaScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === taazaa.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === taazaa.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === taazaa.ACTIVE_JOBS_URL) {
        return [
          {
            id: 134308,
            title: 'AEM Guides Developer',
            description: '<div>Join our Engineering team in Noida/Pune.</div>',
            departmentName: 'Adobe Experience Manager',
            jobLocations: [
              {
                name: 'Noida',
                city: 'Noida',
                state: 'UP',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '5-7',
            jobNumber: 'TZ_303',
            publishedOn: '2026-07-09T09:24:14.463Z',
            skillNames: ['Java', 'AEM'],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [taazaa.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    taazaa.CAREER_PORTAL_INFO_URL,
    taazaa.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'taazaa')
  assert.equal(jobs[0].company, 'TAAZAA')
  assert.equal(jobs[0].link, 'https://taazaa.keka.com/careers/applyjob/134308')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('TAAZAA fails closed when the embedded Keka configuration or exact portal identity changes', async () => {
  const taazaa = await loadModule()

  await assert.rejects(
    taazaa.createTaazaaScraper().run({
      fetchText: async () => careersHtml.replace(
        'caf439a8-817a-46f5-917f-c6aef6ab6beb',
        '11111111-2222-3333-4444-555555555555',
      ),
      fetchJson: async () => portalInfo,
    }),
    /verified Keka embed configuration changed materially/i,
  )

  await assert.rejects(
    taazaa.createTaazaaScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async (url) => {
        if (url === taazaa.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfo, name: 'Different Company' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
