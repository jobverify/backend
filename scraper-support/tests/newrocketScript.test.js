import assert from 'node:assert/strict'
import test from 'node:test'

const loadNewRocketModule = async () => {
  try {
    return await import('../../scraper/newrocket/script.js')
  } catch {
    assert.fail('Expected NewRocket scraper module at ../../scraper/newrocket/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NewRocket | Anthropic and ServiceNow Partner | AI workflows that customers trust</title>
  </head>
  <body>
    <header>
      <div>Trusted AI, Anthropic and ServiceNow Partner</div>
      <div>Go Beyond Workflows to Solve Business Problems With the Power of ServiceNow</div>
      <nav>
        <a href="/about">About Us</a>
        <a href="/careers">Careers</a>
      </nav>
    </header>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>A Destination for Talent</h1>
      <div>Careers at newrocket</div>
      <h2>People Matter. Employees Matter. You Matter.</h2>
      <div id="job-section">FEATURED ROLES</div>
      <a href="/apply-now" target="_blank">See all Jobs</a>
      <script>
        request.open('GET', 'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs?content=true', true)
        window.location.href = "https://www.newrocket.com/careers/job?gh_jid=" + job.id
      </script>
    </main>
  </body>
</html>
`

const officialApplyNowHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <div>APPLY AT NEWROCKET</div>
      <h1>A Destination for Talent</h1>
      <div>OPEN ROLES</div>
      <h2>Help us deliver meaningful experiences and extraordinary results</h2>
      <script>
        request.open('GET', 'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs?content=true', true)
        window.location.href = "https://www.newrocket.com/careers/job?gh_jid=" + job.id
      </script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 6101286004,
      title: 'Forward Deployed AI Engineer',
      location: { name: 'India - Remote' },
      absolute_url: 'https://www.newrocket.com/careers/job?gh_jid=6101286004&gh_jid=6101286004',
      departments: [{ name: 'Agentic AI' }],
      offices: [{ location: 'Pune, Maharashtra, India' }],
      requisition_id: '1657',
      updated_at: '2026-06-29T02:11:52-04:00',
      content: '&lt;p&gt;Build AI workflows for customer deployments.&lt;/p&gt;',
    },
    {
      id: 6113602004,
      title: 'Order Management Support Engineer ',
      location: { name: 'Pune' },
      absolute_url: 'https://www.newrocket.com/careers/job?gh_jid=6113602004&gh_jid=6113602004',
      departments: [{ name: 'Operations' }],
      offices: [{ location: 'Pune, Maharashtra, India' }],
      requisition_id: '1668',
      updated_at: '2026-07-01T08:15:00-04:00',
      content: '&lt;p&gt;Support customer order fulfillment.&lt;/p&gt;',
    },
    {
      id: 5994072004,
      title: 'VP/Field CTO, GTM - Telecommunications',
      location: { name: 'Remote' },
      absolute_url: 'https://www.newrocket.com/careers/job?gh_jid=5994072004&gh_jid=5994072004',
      departments: [{ name: 'Growth & Alliances' }],
      offices: [{ location: null }],
      requisition_id: '1600',
      updated_at: '2026-05-14T14:19:09-04:00',
      content: '&lt;p&gt;Lead telecom go-to-market strategy.&lt;/p&gt;',
    },
  ],
}

test('NewRocket constants stay pinned to the verified first-party homepage, careers, apply-now, and Greenhouse handoff', async () => {
  const newrocket = await loadNewRocketModule()

  assert.equal(newrocket.SOURCE, 'newrocket')
  assert.equal(newrocket.COMPANY, 'NewRocket')
  assert.equal(newrocket.HOMEPAGE_URL, 'https://www.newrocket.com/')
  assert.equal(newrocket.CAREERS_URL, 'https://www.newrocket.com/careers')
  assert.equal(newrocket.APPLY_NOW_URL, 'https://www.newrocket.com/apply-now')
  assert.equal(
    newrocket.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs',
  )
  assert.equal(
    newrocket.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs?content=true',
  )
  assert.equal(newrocket.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(newrocket.hasHomepageCareersLink(officialHomepageHtml), true)
  assert.equal(newrocket.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(newrocket.hasCareersApplyNowLink(officialCareersHtml), true)
  assert.equal(newrocket.hasOfficialApplyNowSignal(officialApplyNowHtml), true)
  assert.equal(newrocket.hasGreenhouseJobsFeedSignal(officialCareersHtml), true)
  assert.equal(newrocket.hasGreenhouseJobsFeedSignal(officialApplyNowHtml), true)
  assert.equal(newrocket.hasGreenhouseJobDetailHandoff(officialCareersHtml), true)
  assert.equal(newrocket.hasGreenhouseJobDetailHandoff(officialApplyNowHtml), true)
  assert.equal(
    newrocket.normalizeGreenhouseJobUrl(
      'https://www.newrocket.com/careers/job?gh_jid=6101286004&gh_jid=6101286004',
      6101286004,
    ),
    'https://www.newrocket.com/careers/job?gh_jid=6101286004',
  )
})

test('extractIndiaJobsFromGreenhousePayload keeps only verified India jobs and normalizes first-party URLs', async () => {
  const newrocket = await loadNewRocketModule()

  const jobs = newrocket.extractIndiaJobsFromGreenhousePayload(greenhousePayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Forward Deployed AI Engineer',
    company: 'NewRocket',
    location: 'India - Remote',
    city: 'Remote',
    country: 'India',
    link: 'https://www.newrocket.com/careers/job?gh_jid=6101286004',
    applyUrl: 'https://www.newrocket.com/careers/job?gh_jid=6101286004',
    sourceUrl: 'https://www.newrocket.com/careers/job?gh_jid=6101286004',
    source: 'newrocket',
    jobId: 6101286004,
    requisitionId: '1657',
    department: 'Agentic AI',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build AI workflows for customer deployments.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29T02:11:52-04:00',
    remoteStatus: 'Remote',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.deepEqual(jobs[1], {
    title: 'Order Management Support Engineer',
    company: 'NewRocket',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    link: 'https://www.newrocket.com/careers/job?gh_jid=6113602004',
    applyUrl: 'https://www.newrocket.com/careers/job?gh_jid=6113602004',
    sourceUrl: 'https://www.newrocket.com/careers/job?gh_jid=6113602004',
    source: 'newrocket',
    jobId: 6113602004,
    requisitionId: '1668',
    department: 'Operations',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Support customer order fulfillment.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T08:15:00-04:00',
    remoteStatus: 'On-site',
    scrapedAt: jobs[1].scrapedAt,
  })
})

test('NewRocket run validates official first-party surfaces before fetching the public Greenhouse jobs feed', async () => {
  const newrocket = await loadNewRocketModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await newrocket.createNewRocketScraper().run({
    fetchText: async (url) => {
      requestedPages.push(url)

      if (url === newrocket.HOMEPAGE_URL) return officialHomepageHtml
      if (url === newrocket.CAREERS_URL) return officialCareersHtml
      if (url === newrocket.APPLY_NOW_URL) return officialApplyNowHtml

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return greenhousePayload
    },
  })

  assert.deepEqual(requestedPages, [
    newrocket.HOMEPAGE_URL,
    newrocket.CAREERS_URL,
    newrocket.APPLY_NOW_URL,
  ])
  assert.deepEqual(requestedJson, [
    {
      url: newrocket.buildGreenhouseJobsApiUrl(),
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'newrocket')
  assert.equal(jobs[1].source, 'newrocket')
})

test('NewRocket fails closed when the verified homepage, careers page, or apply-now jobs handoff changes', async () => {
  const newrocket = await loadNewRocketModule()

  await assert.rejects(
    newrocket.createNewRocketScraper().run({
      fetchText: async (url) => {
        if (url === newrocket.HOMEPAGE_URL) {
          return '<html><body><a href="/careers">Careers</a></body></html>'
        }

        if (url === newrocket.CAREERS_URL) return officialCareersHtml
        return officialApplyNowHtml
      },
      fetchJson: async () => greenhousePayload,
    }),
    /homepage no longer matches the verified official site/i,
  )

  await assert.rejects(
    newrocket.createNewRocketScraper().run({
      fetchText: async (url) => {
        if (url === newrocket.HOMEPAGE_URL) return officialHomepageHtml
        if (url === newrocket.CAREERS_URL) return officialCareersHtml.replace('/apply-now', '/join-us')
        return officialApplyNowHtml
      },
      fetchJson: async () => greenhousePayload,
    }),
    /careers page no longer links to the verified apply-now jobs surface/i,
  )

  await assert.rejects(
    newrocket.createNewRocketScraper().run({
      fetchText: async (url) => {
        if (url === newrocket.HOMEPAGE_URL) return officialHomepageHtml
        if (url === newrocket.CAREERS_URL) return officialCareersHtml
        return officialApplyNowHtml.replace(
          'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs?content=true',
          'https://boards-api.greenhouse.io/v1/boards/other/jobs?content=true',
        )
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified public greenhouse jobs api/i,
  )

  await assert.rejects(
    newrocket.createNewRocketScraper().run({
      fetchText: async (url) => {
        if (url === newrocket.HOMEPAGE_URL) return officialHomepageHtml
        if (url === newrocket.CAREERS_URL) return officialCareersHtml
        return officialApplyNowHtml.replace(
          'https://www.newrocket.com/careers/job?gh_jid=',
          'https://www.newrocket.com/jobs/',
        )
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified gh_jid job detail handoff/i,
  )
})
