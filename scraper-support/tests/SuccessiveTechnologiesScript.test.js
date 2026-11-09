import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/successivetechnologies/script.js')
  } catch {
    assert.fail('Expected Successive Technologies scraper module at ../../scraper/successivetechnologies/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Successive Technologies | Explore Job Openings Successive Digital</title>
  </head>
  <body>
    <div id="jobs">Loading open positions…</div>
    <script>
      window.khConfig = {
        domain: 'https://successivesoftware.keka.com/careers/',
        targetContainer: '#jobs'
      }
    </script>
    <script src="https://successivesoftware.keka.com/careers/api/embedjobs/js/a0dbae8a-c880-42dd-8947-466574e4de7d"></script>
  </body>
</html>
`

const kekaShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      fetch('/ats/documents/a0dbae8a-c880-42dd-8947-466574e4de7d/careerportal/d0a9141b8cd04b1c9bd7a8f00a65def0.html')
    </script>
  </body>
</html>
`

const portalInfo = {
  name: 'Successive Technologies Pvt. Ltd.',
  shortName: 'Successive Technologies Pvt. Ltd.',
  careersPortalDomain: 'successivesoftware.keka.com',
  companyWebsite: '',
}

test('Successive Technologies constants stay pinned to the verified first-party Keka handoff', async () => {
  const successive = await loadModule()

  assert.equal(successive.SOURCE, 'successivetechnologies')
  assert.equal(successive.COMPANY, 'Successive Technologies')
  assert.equal(successive.CAREERS_URL, 'https://successive.tech/careers/jobsearch/')
  assert.equal(successive.KEKA_BOARD_URL, 'https://successivesoftware.keka.com/careers/')
  assert.equal(
    successive.EXPECTED_IDENTIFIER,
    'a0dbae8a-c880-42dd-8947-466574e4de7d',
  )
  assert.equal(successive.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(
    successive.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/a0dbae8a-c880-42dd-8947-466574e4de7d/careerportal/d0a9141b8cd04b1c9bd7a8f00a65def0.html',
  )
  assert.deepEqual(successive.extractCareerConfig(careersPageHtml), {
    identifier: 'a0dbae8a-c880-42dd-8947-466574e4de7d',
    domain: 'https://successivesoftware.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(successive.hasExpectedPortalIdentity(portalInfo), true)
})

test('Successive Technologies keeps only India jobs from the verified Keka payload', async () => {
  const successive = await loadModule()

  const jobs = successive.extractSearchResults(
    [
      {
        id: 501,
        title: 'QA Engineer',
        description: '<p>Build resilient automation suites.</p>',
        departmentName: 'Engineering',
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
        experience: '4-6 years',
        publishedOn: '2026-07-15T10:00:00.000Z',
        skillNames: ['Playwright', 'TypeScript'],
      },
      {
        id: 999,
        title: 'US Delivery Lead',
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
      domain: 'https://successivesoftware.keka.com/careers/',
    },
  )

  assert.deepEqual(jobs, [
    {
      title: 'QA Engineer',
      company: 'Successive Technologies',
      department: 'Engineering',
      location: 'Noida, UP, India',
      city: 'Noida',
      state: 'UP',
      country: 'India',
      jobId: '501',
      requisitionId: '501',
      sourceUrl: 'https://successivesoftware.keka.com/careers/jobdetails/501',
      applyUrl: 'https://successivesoftware.keka.com/careers/applyjob/501',
      employmentType: 'Full Time',
      experienceRequired: '4-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Playwright', 'TypeScript'],
      postingDate: '2026-07-15',
      closingDate: null,
      jobDescription: 'Build resilient automation suites.',
    },
  ])
})

test('Successive Technologies run accepts an empty verified active jobs feed and returns no jobs', async () => {
  const successive = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await successive.createSuccessiveTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === successive.CAREERS_URL) return careersPageHtml
      if (url === successive.KEKA_BOARD_URL) return kekaShellHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://successivesoftware.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://successivesoftware.keka.com/careers/api/embedjobs/default/active/a0dbae8a-c880-42dd-8947-466574e4de7d') {
        return []
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    'https://successive.tech/careers/jobsearch/',
    'https://successivesoftware.keka.com/careers/',
  ])
  assert.deepEqual(requestedJson, [
    'https://successivesoftware.keka.com/careers/api/organization/default/careerportalinfo',
    'https://successivesoftware.keka.com/careers/api/embedjobs/default/active/a0dbae8a-c880-42dd-8947-466574e4de7d',
  ])
  assert.deepEqual(jobs, [])
})

test('Successive Technologies fails closed when the verified Keka portal identity changes', async () => {
  const successive = await loadModule()

  await assert.rejects(
    successive.createSuccessiveTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === successive.CAREERS_URL) return careersPageHtml
        return kekaShellHtml
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
