import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/healthasyst/script.js')
  } catch {
    assert.fail('Expected HealthAsyst scraper module at ../../scraper/healthasyst/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | HealthAsyst</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Check out the open positions</p>
    <a href="https://healthasyst.keka.com/careers/">Click here</a>
  </body>
</html>
`

const careersHtmlWithoutTrailingSlash = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | HealthAsyst</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Check out the open positions</p>
    <a href="https://healthasyst.keka.com/careers">Click here</a>
  </body>
</html>
`

const portalInfo = {
  name: 'HealthAsyst',
  shortName: 'HealthAsyst',
  careersPortalDomain: 'healthasyst.keka.com',
  companyWebsite: 'https://www.healthasyst.com/',
}

test('HealthAsyst validates the verified official careers handoff and exact portal identity', async () => {
  const healthAsyst = await loadModule()

  assert.equal(healthAsyst.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    healthAsyst.extractExternalHandoffUrl(careersHtml),
    'https://healthasyst.keka.com/careers/',
  )
  assert.equal(healthAsyst.hasExpectedPortalIdentity(portalInfo), true)
})

test('HealthAsyst accepts the live Keka handoff URL even when the careers link omits the trailing slash', async () => {
  const healthAsyst = await loadModule()

  assert.equal(healthAsyst.hasOfficialCareersPageSignal(careersHtmlWithoutTrailingSlash), true)
  assert.equal(
    healthAsyst.extractExternalHandoffUrl(careersHtmlWithoutTrailingSlash),
    'https://healthasyst.keka.com/careers',
  )
})

test('HealthAsyst run accepts the live Keka handoff URL even when the careers link omits the trailing slash', async () => {
  const healthAsyst = await loadModule()

  const jobs = await healthAsyst.createHealthAsystScraper().run({
    fetchText: async () => careersHtmlWithoutTrailingSlash,
    fetchJson: async (url) => {
      if (url === healthAsyst.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === healthAsyst.ACTIVE_JOBS_URL) return []
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})

test('HealthAsyst keeps only India jobs from the verified Keka payload and maps them to the shared shape', async () => {
  const healthAsyst = await loadModule()

  const jobs = healthAsyst.extractSearchResults(
    [
      {
        id: 130507,
        title: 'Customer Success Manager',
        description: '<div>Drive long-term customer success.</div>',
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
        experience: '8+ years',
        jobNumber: 'HA_130507',
        publishedOn: '2026-07-18T00:00:00.000Z',
        skillNames: ['Customer Success', 'Healthcare'],
      },
      {
        id: 130900,
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
      domain: 'https://healthasyst.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Customer Success Manager',
    company: 'HealthAsyst',
    department: 'Customer Success',
    location: 'Bangalore, KA, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '130507',
    requisitionId: 'HA_130507',
    sourceUrl: 'https://healthasyst.keka.com/careers/jobdetails/130507',
    applyUrl: 'https://healthasyst.keka.com/careers/applyjob/130507',
    employmentType: 'Full Time',
    experienceRequired: '8+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Customer Success', 'Healthcare'],
    postingDate: '2026-07-18',
    closingDate: null,
    jobDescription: 'Drive long-term customer success.',
  })
})

test('HealthAsyst run validates the official careers handoff, exact Keka portal identity, and decorates India jobs', async () => {
  const healthAsyst = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await healthAsyst.createHealthAsystScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === healthAsyst.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === healthAsyst.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === healthAsyst.ACTIVE_JOBS_URL) {
        return [
          {
            id: 130507,
            title: 'Customer Success Manager',
            description: '<div>Drive long-term customer success.</div>',
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
            experience: '8+ years',
            jobNumber: 'HA_130507',
            publishedOn: '2026-07-18T00:00:00.000Z',
            skillNames: ['Customer Success', 'Healthcare'],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [healthAsyst.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    healthAsyst.CAREER_PORTAL_INFO_URL,
    healthAsyst.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'healthasyst')
  assert.equal(jobs[0].company, 'HealthAsyst')
  assert.equal(jobs[0].link, 'https://healthasyst.keka.com/careers/applyjob/130507')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('HealthAsyst fails closed when the official careers handoff or exact portal identity changes', async () => {
  const healthAsyst = await loadModule()

  await assert.rejects(
    healthAsyst.createHealthAsystScraper().run({
      fetchText: async () => careersHtml.replace('https://healthasyst.keka.com/careers/', 'https://example.com/jobs'),
      fetchJson: async () => portalInfo,
    }),
    /verified official careers handoff/i,
  )

  await assert.rejects(
    healthAsyst.createHealthAsystScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async (url) => {
        if (url === healthAsyst.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfo, name: 'Different Company' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
