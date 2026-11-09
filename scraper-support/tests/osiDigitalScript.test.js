import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h1>Build Your Dream Career with OSI Digital</h1>
    <h2>Current Opportunities</h2>
    <p>All candidates are encouraged to apply for active positions via the OSI Digital website or our LinkedIn page.</p>
    <p>If you are interested in applying for a position with us, please submit your resume below.</p>
    <a href="https://osidigital.com/careers/job_openings/">APPLY TODAY</a>
  </body>
</html>
`

const jobOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings</title>
  </head>
  <body>
    <h1>Join the OSI Digital Family</h1>
    <p>We have a number of open positions available in a variety of roles around the world at OSI Digital.</p>
    <div id="jobs"></div>
    <script>
      var settings = {
        "url": "https://api.turbohire.co/api/careerpagejobs",
        "method": "POST",
        "headers": {
          "X-Api-Key": "osi-public-key"
        }
      };
    </script>
  </body>
</html>
`

const turboHirePayload = {
  Total: 2,
  Result: [
    {
      JobId: '453919d0-eddc-45c5-862b-ec415a37bf81',
      JobTitle: 'Test Automation Engineer ',
      JobDescription: '<p>Build resilient Java and Playwright automation.</p>',
      Department: 'DE-QE',
      Location: '[{"Address":"Hyderabad, Telangana, India","PlaceId":null}]',
      Experience: {
        MinExp: 3,
        MaxExp: 5,
      },
      JobType: 'Full Time',
      ApplyUrl: 'https://osidigital.turbohire.co/job/publicjobs/453919d0-eddc-45c5-862b-ec415a37bf81?utm_source=CareerPage',
      PublishedDate: '2026-07-30T05:18:34.5759429Z',
      Skills: ['Test Automation', 'Java', ' PlayWright '],
    },
    {
      JobId: 'us-public-role-1',
      JobTitle: 'Cloud Architect',
      JobDescription: '<p>Lead enterprise cloud programs.</p>',
      Department: 'Cloud',
      Location: '[{"Address":"Dallas, Texas, United States","PlaceId":null}]',
      Experience: {
        MinExp: 8,
        MaxExp: 10,
      },
      JobType: 'Full Time',
      ApplyUrl: 'https://osidigital.turbohire.co/job/publicjobs/us-public-role-1?utm_source=CareerPage',
      PublishedDate: '2026-07-28T11:00:00.0000000Z',
      Skills: ['AWS'],
    },
  ],
}

const changedJobOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings</title>
  </head>
  <body>
    <h1>Join the OSI Digital Family</h1>
    <div id="jobs"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/osidigital/script.js')
  } catch {
    assert.fail('Expected OSI Digital scraper module at ../../scraper/osidigital/script.js')
  }
}

test('OSI Digital extracts India jobs from the verified first-party TurboHire public feed', async () => {
  const osi = await loadModule()

  assert.equal(osi.SOURCE, 'osidigital')
  assert.equal(osi.COMPANY, 'OSI Digital')
  assert.equal(osi.CAREERS_URL, 'https://osidigital.com/careers/')
  assert.equal(osi.JOB_OPENINGS_URL, 'https://osidigital.com/careers/job_openings/')
  assert.equal(osi.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(osi.hasOfficialJobOpeningsSignal(jobOpeningsHtml), true)
  assert.deepEqual(osi.extractTurboHireApiConfig(jobOpeningsHtml), {
    apiUrl: 'https://api.turbohire.co/api/careerpagejobs',
    apiKey: 'osi-public-key',
  })

  assert.deepEqual(osi.extractPublicJobs(turboHirePayload), [
    {
      title: 'Test Automation Engineer',
      company: 'OSI Digital',
      department: 'DE-QE',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '453919d0-eddc-45c5-862b-ec415a37bf81',
      requisitionId: '453919d0-eddc-45c5-862b-ec415a37bf81',
      sourceUrl: 'https://osidigital.turbohire.co/job/publicjobs/453919d0-eddc-45c5-862b-ec415a37bf81?utm_source=CareerPage',
      applyUrl: 'https://osidigital.turbohire.co/job/publicjobs/453919d0-eddc-45c5-862b-ec415a37bf81?utm_source=CareerPage',
      employmentType: 'Full Time',
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Test Automation', 'Java', 'PlayWright'],
      postingDate: '2026-07-30T05:18:34.5759429Z',
      closingDate: null,
      jobDescription: 'Build resilient Java and Playwright automation.',
    },
  ])
})

test('OSI Digital scraper follows the verified job openings handoff and decorates public India jobs', async () => {
  const osi = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await osi.createOsiDigitalScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === osi.CAREERS_URL) return careersHtml
      if (url === osi.JOB_OPENINGS_URL) return jobOpeningsHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return turboHirePayload
    },
    now: () => '2026-08-03T12:34:56.000Z',
  })

  assert.deepEqual(requestedTexts, [osi.CAREERS_URL, osi.JOB_OPENINGS_URL])
  assert.deepEqual(requestedJson, [
    {
      url: 'https://api.turbohire.co/api/careerpagejobs',
      options: {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
          Accept: 'application/json',
          'X-Api-Key': 'osi-public-key',
        },
        label: 'osidigital-public-jobs',
        timeoutMs: 15000,
      },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'osidigital')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-03T12:34:56.000Z')
})

test('OSI Digital fails closed if the verified job openings page stops exposing the public API config', async () => {
  const osi = await loadModule()

  await assert.rejects(
    osi.createOsiDigitalScraper().run({
      fetchText: async (url) => {
        if (url === osi.CAREERS_URL) return careersHtml
        if (url === osi.JOB_OPENINGS_URL) return changedJobOpeningsHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => turboHirePayload,
    }),
    /public jobs surface/i,
  )
})
