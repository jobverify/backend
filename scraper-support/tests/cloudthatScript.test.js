import assert from 'node:assert/strict'
import test from 'node:test'

const loadCloudThatModule = async () => {
  try {
    return await import('../../scraper/cloudthat/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <header>
      <img src="/ats/documents/0f81f802-65fe-44de-96af-5e42436d1e3c/orglogo/03989c1774974b45b933bfa1045456b4.png" />
      <a href="https://www.Cloudthat.com">Home</a>
    </header>
    <main>
      <img src="/ats/documents/0f81f802-65fe-44de-96af-5e42436d1e3c/careersportalbackground/9f31b66fcf1d4fe88a9717f3eb22c339.png" />
      <div id="kh-jobs-section"></div>
    </main>
  </body>
</html>
`

test('extractCareerConfig resolves the CloudThat Keka identifier from the public careers page markup', async () => {
  const cloudthat = await loadCloudThatModule()
  assert.ok(cloudthat)

  assert.deepEqual(
    cloudthat.extractCareerConfig(careerPageHtml),
    {
      identifier: '0f81f802-65fe-44de-96af-5e42436d1e3c',
      domain: 'https://cloudthat.keka.com/careers/',
      portalName: 'default',
    },
  )

  assert.equal(
    cloudthat.buildActiveJobsUrl(cloudthat.extractCareerConfig(careerPageHtml)),
    'https://cloudthat.keka.com/careers/api/embedjobs/default/active/0f81f802-65fe-44de-96af-5e42436d1e3c',
  )
})

test('extractSearchResults maps CloudThat Keka jobs into the shared scraper contract', async () => {
  const cloudthat = await loadCloudThatModule()
  assert.ok(cloudthat)

  const jobs = cloudthat.extractSearchResults(
    [
      {
        id: 133534,
        title: 'Azure Solution Architect (SME)',
        description: '<div>Design and optimize Microsoft Azure solutions.</div>',
        departmentName: 'TC - Migration and FinOps',
        jobLocations: [
          {
            id: 26178,
            name: 'Ahmedabad, India',
            city: 'Ahmedabad',
            state: 'GJ',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '3.5 - 6.5 Yrs',
        salaryRangeFormat: '',
        publishedOn: '2026-07-02T12:40:07.72Z',
        skillNames: [],
      },
      {
        id: 133470,
        title: 'Technical Presales - Executive',
        description: '<div>Support the sales team with technical presentations.</div>',
        departmentName: 'TC - Pre-Sales',
        jobLocations: [
          {
            id: 28828,
            city: 'Delhi',
            locationIdentifier: '8cb9705c-d319-44c6-b55e-2246e71e96d7',
          },
        ],
        jobType: 2,
        experience: '1-3 Yrs',
        salaryRangeFormat: '',
        publishedOn: '2026-07-02T05:54:54.347Z',
        skillNames: [],
      },
    ],
    {
      kekaDomain: 'https://cloudthat.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Azure Solution Architect (SME)',
    company: 'CloudThat',
    department: 'TC - Migration and FinOps',
    location: 'Ahmedabad, India',
    city: 'Ahmedabad',
    country: 'India',
    jobId: '133534',
    requisitionId: '133534',
    sourceUrl: 'https://cloudthat.keka.com/careers/jobdetails/133534',
    applyUrl: 'https://cloudthat.keka.com/careers/jobdetails/133534',
    employmentType: 'Full Time',
    experienceRequired: '3.5 - 6.5 Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-02',
    closingDate: null,
    jobDescription: 'Design and optimize Microsoft Azure solutions.',
    remoteStatus: 'On-site',
    compensation: null,
  })
  assert.equal(jobs[1].title, 'Technical Presales - Executive')
  assert.equal(jobs[1].location, 'Delhi, India')
  assert.equal(jobs[1].city, 'Delhi')
  assert.equal(jobs[1].country, 'India')
})

test('run fetches the CloudThat careers page, resolves the active Keka feed, and decorates jobs', async () => {
  const cloudthat = await loadCloudThatModule()
  assert.ok(cloudthat)

  const requestedTexts = []
  const requestedJson = []
  const scraper = cloudthat.createCloudThatScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === cloudthat.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://cloudthat.keka.com/careers/api/embedjobs/default/active/0f81f802-65fe-44de-96af-5e42436d1e3c') {
        return [
          {
            id: 133509,
            title: 'AWS Solutions Architect (SME)',
            description: '<div>Design and support AWS cloud solutions.</div>',
            departmentName: 'TC - Migration and FinOps',
            jobLocations: [
              {
                id: 26178,
                name: 'Ahmedabad, India',
                city: 'Ahmedabad',
                state: 'GJ',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '3.5 - 6.5 Yrs',
            salaryRangeFormat: '',
            publishedOn: '2026-07-02T11:24:13.97Z',
            skillNames: [],
          },
        ]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [cloudthat.CAREER_PAGE_URL])
  assert.deepEqual(requestedJson, [
    'https://cloudthat.keka.com/careers/api/embedjobs/default/active/0f81f802-65fe-44de-96af-5e42436d1e3c',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cloudthat')
  assert.equal(jobs[0].link, 'https://cloudthat.keka.com/careers/jobdetails/133509')
  assert.equal(jobs[0].company, 'CloudThat')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
