import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Ferfier Technologies | Shape the Future with Innovation</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team and Shape the Future</h1>
      <p>Explore Open Positions</p>
      <a href="https://interrait.com/explore-open-positions/">Explore Open Positions</a>
    </main>
  </body>
</html>
`

const openPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Open Positions - InterraIT</title>
  </head>
  <body>
    <h1>Join Our Team</h1>
    <script>
      window.khConfig = {
        identifier: 'ff171441-bd55-480d-be5e-589b516ed6aa',
        domain: 'https://interrait.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://interrait.keka.com/careers/api/embedjobs/js/ff171441-bd55-480d-be5e-589b516ed6aa" defer></script>
  </body>
</html>
`

const portalInfo = {
  name: 'Ferfier Technologies',
  shortName: 'Ferfier Technologies',
  careersPortalDomain: 'interrait.keka.com',
}

const jobsPayload = [
  {
    id: 82588,
    title: 'Sr Embedded Software Engineer',
    description: '<div>Build embedded systems for the next generation mobility stack.</div>',
    departmentName: 'Emerging',
    jobLocations: [
      {
        name: 'Noida',
        city: 'Noida',
        state: 'UP',
        countryCode: 'IN',
        countryName: 'India',
      },
      {
        name: 'Remote',
        city: '.',
        state: 'AS',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '5 years',
    publishedOn: '2026-07-31T16:18:10.063Z',
    skillNames: ['Embedded', 'C++'],
  },
  {
    id: 9300,
    title: 'US SharePoint Architect',
    description: '<div>Should be filtered out.</div>',
    departmentName: 'Architecture',
    jobLocations: [
      {
        name: 'Dallas',
        city: 'Dallas',
        state: 'TX',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '8 years',
    publishedOn: '2026-07-29T10:00:00.000Z',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/interrainformationtechnologies/script.js')
  } catch {
    assert.fail('Expected Interra Information Technologies scraper module at ../../scraper/interrainformationtechnologies/script.js')
  }
}

test('Interra Information Technologies helpers stay pinned to the verified first-party careers shell and Keka handoff', async () => {
  const interra = await loadModule()

  assert.equal(interra.CAREERS_URL, 'https://interrait.com/career/')
  assert.equal(interra.OPEN_POSITIONS_URL, 'https://interrait.com/explore-open-positions/')
  assert.equal(interra.KEKA_CAREERS_URL, 'https://interrait.keka.com/careers/')
  assert.equal(interra.EXPECTED_IDENTIFIER, 'ff171441-bd55-480d-be5e-589b516ed6aa')
  assert.equal(
    interra.buildCareerPortalInfoUrl({
      domain: 'https://interrait.keka.com/careers/',
      portalName: 'default',
    }),
    'https://interrait.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(interra.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(interra.hasOpenPositionsSignal(openPositionsHtml), true)
  assert.deepEqual(interra.extractCareerConfig(openPositionsHtml), {
    identifier: 'ff171441-bd55-480d-be5e-589b516ed6aa',
    domain: 'https://interrait.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(interra.hasExpectedPortalIdentity(portalInfo), true)
  assert.deepEqual(
    interra.extractSearchResults(jobsPayload, {
      domain: 'https://interrait.keka.com/careers/',
    }).map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Sr Embedded Software Engineer',
        location: 'Noida, Remote, India',
        country: 'India',
        sourceUrl: 'https://interrait.keka.com/careers/jobdetails/82588',
      },
    ],
  )
})

test('Interra Information Technologies keeps validating the handoff after the careers SEO title changes', async () => {
  const interra = await loadModule()
  const currentCareers = careersHtml.replace(
    'Careers at Ferfier Technologies | Shape the Future with Innovation',
    'Careers at InterraIT | Jobs in AI, Cloud &amp; Cybersecurity',
  )
  assert.equal(interra.hasOfficialCareersSignal(currentCareers), true)
  assert.equal(interra.hasOfficialCareersSignal(currentCareers.replace('Explore Open Positions', 'Unrelated link').replace('/explore-open-positions/', '/unrelated/')), false)
  assert.equal(interra.hasOfficialCareersSignal(currentCareers.replace('Careers at InterraIT', 'Careers at Another Company')), false)
})

test('Interra Information Technologies run validates the careers shell and filters the first-party Keka jobs payload to India roles', async () => {
  const interra = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await interra.createInterraInformationTechnologiesScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === interra.CAREERS_URL) return careersHtml
      if (url === interra.OPEN_POSITIONS_URL) return openPositionsHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://interrait.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://interrait.keka.com/careers/api/embedjobs/default/active/ff171441-bd55-480d-be5e-589b516ed6aa') {
        return jobsPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    interra.CAREERS_URL,
    interra.OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(requestedJson, [
    'https://interrait.keka.com/careers/api/organization/default/careerportalinfo',
    'https://interrait.keka.com/careers/api/embedjobs/default/active/ff171441-bd55-480d-be5e-589b516ed6aa',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Sr Embedded Software Engineer',
      company: 'Interra Information Technologies',
      department: 'Emerging',
      location: 'Noida, Remote, India',
      city: 'Noida',
      state: 'UP',
      country: 'India',
      jobId: '82588',
      requisitionId: '82588',
      sourceUrl: 'https://interrait.keka.com/careers/jobdetails/82588',
      applyUrl: 'https://interrait.keka.com/careers/applyjob/82588',
      employmentType: 'Full Time',
      experienceRequired: '5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Embedded', 'C++'],
      postingDate: '2026-07-31',
      closingDate: null,
      jobDescription: 'Build embedded systems for the next generation mobility stack.',
      link: 'https://interrait.keka.com/careers/applyjob/82588',
      source: 'interrainformationtechnologies',
      scrapedAt: '2026-07-18T00:00:00.000Z',
      companyCareerPage: 'https://interrait.com/career/',
      companyDomain: 'interrait.com',
      atsPlatform: 'keka-embed-api',
    },
  ])
})

test('Interra Information Technologies falls back to the pinned Keka ATS when the first-party pages time out', async () => {
  const interra = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await interra.createInterraInformationTechnologiesScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      throw new Error(`fetch failed | Connect Timeout Error (attempted address: ${new URL(url).hostname}:443, timeout: 10000ms)`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://interrait.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://interrait.keka.com/careers/api/embedjobs/default/active/ff171441-bd55-480d-be5e-589b516ed6aa') {
        return jobsPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    interra.CAREERS_URL,
  ])
  assert.deepEqual(requestedJson, [
    'https://interrait.keka.com/careers/api/organization/default/careerportalinfo',
    'https://interrait.keka.com/careers/api/embedjobs/default/active/ff171441-bd55-480d-be5e-589b516ed6aa',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '82588')
  assert.equal(jobs[0].source, 'interrainformationtechnologies')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})
