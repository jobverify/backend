import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | AIG Healthcare</title>
  </head>
  <body>
    <main>
      <h2>Join Our Dynamic Team</h2>
      <p>Current Job Openings</p>
      <a href="https://aighealthcare.in/openings">Read More</a>
    </main>
  </body>
</html>
`

const openingsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Openings | AIG Healthcare</title>
  </head>
  <body>
    <section>
      <h2>Openings</h2>
      <h3>Join the rightful revolution, Join AIG Healthcare</h3>
      <p>Welcome to IKS Health</p>
      <a href="https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001">Careers Page</a>
    </section>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IKS Health - External Career Site</title>
    <base href="/hcmUI/CandidateExperience/en/sites/CX_3001" data-apibaseurl="https://eiyi.fa.ap1.oraclecloud.com:443" data-sitenumber="CX_3001">
  </head>
  <body>
    <main>Jobs</main>
  </body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 2,
    TotalJobsCount: 2,
    requisitionList: [
      {
        Id: '7596',
        Title: 'Business Analyst',
        PrimaryLocation: 'Hyderabad, Telangana, India',
        PrimaryLocationCountry: 'IN',
        Organization: 'Operations',
        JobSchedule: 'Full time',
        ExternalPostedStartDate: '2026-07-30',
        ShortDescriptionStr: 'Support business transformation initiatives.',
      },
      {
        Id: '7601',
        Title: 'US Intake Coordinator',
        PrimaryLocation: 'Dallas, Texas, United States',
        PrimaryLocationCountry: 'US',
        Organization: 'Operations',
      },
      {
        Id: '7602',
        Title: 'Senior Analyst',
        PrimaryLocation: 'Pune, Maharashtra, India',
        PrimaryLocationCountry: 'IN',
        Department: 'Analytics',
        JobSchedule: 'Full time',
        PostedDate: '2026-07-29',
        ShortDescriptionStr: 'Analyze operational metrics.',
      },
    ],
  }],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/aigbusinesssolution/script.js')
  } catch {
    assert.fail('Expected AIG Business Solution scraper module at ../../scraper/aigbusinesssolution/script.js')
  }
}

test('AIG Business Solution keeps the verified careers shell and openings parser pinned', async () => {
  const aig = await loadModule()

  assert.equal(aig.CAREERS_URL, 'https://aighealthcare.in/careers')
  assert.equal(aig.OPENINGS_URL, 'https://aighealthcare.in/openings')
  assert.equal(aig.CANDIDATE_EXPERIENCE_URL, 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001')
  assert.equal(aig.hasOfficialCareersShellSignal(careersShellHtml), true)
  assert.equal(aig.hasOfficialOpeningsSignal(openingsHtml), true)
  assert.equal(aig.hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
  assert.match(aig.buildSearchUrl(), /siteNumber=CX_3001/)
  assert.deepEqual(aig.extractSearchResults(listingPayload).map((job) => [
    job.title,
    job.location,
    job.applyUrl,
    job.postingDate,
  ]), [
    [
      'Business Analyst',
      'Hyderabad, Telangana, India',
      'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/7596',
      '2026-07-30',
    ],
    [
      'Senior Analyst',
      'Pune, Maharashtra, India',
      'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/7602',
      '2026-07-29',
    ],
  ])
})

test('AIG Business Solution run returns the visible Oracle India openings from the verified openings page', async () => {
  const aig = await loadModule()
  const requestedUrls = []

  const jobs = await aig.createAigBusinessSolutionScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aig.CAREERS_URL) return careersShellHtml
      if (url === aig.OPENINGS_URL) return openingsHtml
      if (url === aig.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected AIG URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, aig.buildSearchUrl({ page: 0 }))
      return listingPayload
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [aig.CAREERS_URL, aig.OPENINGS_URL, aig.CANDIDATE_EXPERIENCE_URL])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl, job.source]),
    [
      [
        'Business Analyst',
        'Hyderabad, Telangana, India',
        'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/7596',
        'aigbusinesssolution',
      ],
      [
        'Senior Analyst',
        'Pune, Maharashtra, India',
        'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/7602',
        'aigbusinesssolution',
      ],
    ],
  )
})

test('AIG Business Solution falls back to the live Oracle board when first-party pages time out', async () => {
  const aig = await loadModule()

  const jobs = await aig.createAigBusinessSolutionScraper().run({
    fetchText: async (url) => {
      if (url === aig.CAREERS_URL || url === aig.OPENINGS_URL) {
        const error = new Error('Connect Timeout Error (attempted address: aighealthcare.in:443, timeout: 10000ms)')
        error.code = 'UND_ERR_CONNECT_TIMEOUT'
        throw error
      }
      if (url === aig.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected AIG URL during timeout fallback test: ${url}`)
    },
    fetchJson: async () => listingPayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Business Analyst')
  assert.equal(jobs[1].title, 'Senior Analyst')
})

test('AIG Business Solution fails closed when the verified openings contract drifts', async () => {
  const aig = await loadModule()

  await assert.rejects(
    aig.createAigBusinessSolutionScraper().run({
      fetchText: async (url) => {
        if (url === aig.CAREERS_URL) return careersShellHtml
        if (url === aig.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
        return openingsHtml.replace('Welcome to IKS Health', 'Welcome elsewhere')
      },
      fetchJson: async () => listingPayload,
    }),
    /verified openings page/i,
  )
})
