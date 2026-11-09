import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section>
      <h2>Recruitment Fraud Alert</h2>
      <p>SOBHA Limited follows a transparent and merit-based recruitment process.</p>
      <h1>CAREERS</h1>
      <a href="#opening" class="first-tablink">CURRENT OPENINGS</a>
    </section>
  </body>
</html>
`

const peopleStrongPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
    <script src="main-P36U4EY7.js" type="module"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const urlInfoPayload = {
  response: {
    url: 'sobhalimited-careers.peoplestrong.com',
    realm: 1368,
    leftLogo: 'https://assets.peoplestrong.com/logo_sobha_ltd.png',
  },
}

const peopleStrongJobsPayload = {
  response: [
    {
      jobCode: 'SOL/EPE/1733299',
      jobTitle: 'Electrical Planning Engineer',
      organizationUnit: 'Sobha ltd',
      locationHierarchy: 'India',
      jobPostedDate: '2026-04-30',
      jobClosureDate: '2026-08-31',
      requisitionId: 1733299,
      expRange: '4 - 7 Years',
      skills: {
        mustTohave: ['Planning', 'Electrical'],
        goodtohave: ['Primavera'],
      },
    },
    {
      jobCode: 'SOL/TMP/1714546',
      jobTitle: 'Team Member Presales',
      organizationUnit: 'Sobha ltd',
      locationHierarchy: 'India',
      jobPostedDate: '2026-04-06',
      jobClosureDate: '2026-12-31',
      requisitionId: 1714546,
      expRange: null,
      skills: {},
    },
  ],
  totalRecords: 2,
}

const loadSobhaModule = async () => {
  try {
    return await import('../../scraper/sobha/script.js')
  } catch {
    assert.fail('Expected Sobha scraper module at ../../scraper/sobha/script.js')
  }
}

test('Sobha pins the official careers page and PeopleStrong Candidate Portal API surface', async () => {
  const sobha = await loadSobhaModule()

  assert.equal(sobha.SOURCE, 'sobha')
  assert.equal(sobha.CAREERS_URL, 'https://www.sobha.com/careers/')
  assert.equal(sobha.PEOPLESTRONG_PORTAL_URL, 'https://sobhalimited-careers.peoplestrong.com/')
  assert.equal(
    sobha.PEOPLESTRONG_URLINFO_API_URL,
    'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/urlinfo',
  )
  assert.equal(
    sobha.buildPeopleStrongJobsApiUrl({ offset: 0, limit: 100 }),
    'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=100',
  )
  assert.equal(sobha.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(sobha.hasPeopleStrongPortalSignal(peopleStrongPortalHtml), true)
  assert.equal(sobha.hasVerifiedPeopleStrongUrlInfo(urlInfoPayload), true)
})

test('Sobha extracts India jobs from the verified PeopleStrong jobs API payload', async () => {
  const sobha = await loadSobhaModule()

  assert.deepEqual(
    sobha.extractIndiaJobsFromPeopleStrongPayload(peopleStrongJobsPayload, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Electrical Planning Engineer',
        company: 'Sobha Limited',
        location: 'India',
        city: null,
        country: 'India',
        link: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FEPE%2F1733299',
        applyUrl: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FEPE%2F1733299',
        sourceUrl: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FEPE%2F1733299',
        source: 'sobha',
        jobId: 'SOL/EPE/1733299',
        requisitionId: '1733299',
        department: 'Sobha ltd',
        employmentType: null,
        experienceRequired: '4 - 7 Years',
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Planning', 'Electrical', 'Primavera'],
        postingDate: '2026-04-30',
        validThrough: '2026-08-31',
        remoteStatus: 'On-site',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Team Member Presales',
        company: 'Sobha Limited',
        location: 'India',
        city: null,
        country: 'India',
        link: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FTMP%2F1714546',
        applyUrl: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FTMP%2F1714546',
        sourceUrl: 'https://sobhalimited-careers.peoplestrong.com/job/detail/SOL%2FTMP%2F1714546',
        source: 'sobha',
        jobId: 'SOL/TMP/1714546',
        requisitionId: '1714546',
        department: 'Sobha ltd',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-04-06',
        validThrough: '2026-12-31',
        remoteStatus: 'On-site',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Sobha run returns jobs from the verified PeopleStrong API handoff', async () => {
  const sobha = await loadSobhaModule()
  const requested = []

  const jobs = await sobha.createSobhaScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === sobha.CAREERS_URL) return officialCareersHtml
      if (url === sobha.PEOPLESTRONG_PORTAL_URL) return peopleStrongPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      if (url === sobha.PEOPLESTRONG_URLINFO_API_URL) return urlInfoPayload
      if (url === sobha.buildPeopleStrongJobsApiUrl({ offset: 0, limit: 100 })) {
        return peopleStrongJobsPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: sobha.CAREERS_URL },
    { type: 'text', url: sobha.PEOPLESTRONG_PORTAL_URL },
    { type: 'json', url: sobha.PEOPLESTRONG_URLINFO_API_URL, options: { method: 'GET' } },
    {
      type: 'json',
      url: 'https://sobhalimited-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=100',
      options: { method: 'POST', body: {} },
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Electrical Planning Engineer')
})

test('Sobha fails closed when the verified PeopleStrong handoff drifts', async () => {
  const sobha = await loadSobhaModule()

  await assert.rejects(
    sobha.createSobhaScraper().run({
      fetchText: async (url) => {
        if (url === sobha.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => peopleStrongJobsPayload,
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    sobha.createSobhaScraper().run({
      fetchText: async (url) => {
        if (url === sobha.CAREERS_URL) return officialCareersHtml
        if (url === sobha.PEOPLESTRONG_PORTAL_URL) return '<html><title>Different portal</title></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => peopleStrongJobsPayload,
    }),
    /Candidate Portal/i,
  )

  await assert.rejects(
    sobha.createSobhaScraper().run({
      fetchText: async (url) => {
        if (url === sobha.CAREERS_URL) return officialCareersHtml
        if (url === sobha.PEOPLESTRONG_PORTAL_URL) return peopleStrongPortalHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async (url) =>
        url === sobha.PEOPLESTRONG_URLINFO_API_URL
          ? { response: { url: 'another.peoplestrong.com', realm: 1 } }
          : peopleStrongJobsPayload,
    }),
    /company identity/i,
  )

  assert.throws(
    () => sobha.extractIndiaJobsFromPeopleStrongPayload({ response: null }),
    /jobs API response no longer matches/i,
  )
})
