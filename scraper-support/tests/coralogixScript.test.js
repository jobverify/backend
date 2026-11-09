import assert from 'node:assert/strict'
import test from 'node:test'

const loadCoralogixModule = async () => {
  try {
    return await import('../../scraper/coralogix/script.js')
  } catch {
    assert.fail('Expected Coralogix scraper module at ../../scraper/coralogix/script.js')
  }
}

const listingHtml = `
  <html>
    <head>
      <title>Careers - Coralogix (We're Hiring!)</title>
    </head>
    <body>
      <h1>Join the team who is building the future of observability</h1>
      <h2>Open positions</h2>
      <section>
        <h3>Customer Success</h3>
        <a href="/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/">Cloud and Observability Engineer Gurugram</a>
        <a href="/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/">Cloud and Observability Engineer (Remote Role, 6pm - 3am) Remote, India</a>
        <a href="/careers/co/london-uk/AA.100/technical-account-manager/all/">Technical Account Manager London, UK</a>
      </section>
      <section>
        <h3>Snowbit</h3>
        <a href="/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/">Forward Deployed Engineer Gurugram</a>
      </section>
    </body>
  </html>
`

const cloudEngineerHtml = `
  <html>
    <body>
      <h2>Cloud and Observability Engineer</h2>
      <p>Gurugram · Full-time · Intermediate</p>
      <h4>About The Position</h4>
      <p>Work closely with customers and Coralogix TAMs to understand existing monitoring setups.</p>
      <h4>Requirements</h4>
      <ul>
        <li>2+ years in Observability / DevOps / Monitoring roles.</li>
      </ul>
      <h4>Apply for this position</h4>
    </body>
  </html>
`

const remoteEngineerHtml = `
  <html>
    <body>
      <h2>Cloud and Observability Engineer (Remote Role, 6pm - 3am)</h2>
      <p>Remote, India · Full-time · Intermediate</p>
      <h4>About The Position</h4>
      <p>Design alerts and dashboards based on real-world customer use cases.</p>
      <h4>Requirements</h4>
      <ul>
        <li>Experience with scripting and automation.</li>
      </ul>
      <h4>Apply for this position</h4>
    </body>
  </html>
`

const forwardDeployedHtml = `
  <html>
    <body>
      <h2>Forward Deployed Engineer</h2>
      <p>Gurugram · Full-time · Senior</p>
      <h4>About The Position</h4>
      <p>Own strategic customer deployments and build production-grade solutions.</p>
      <h4>Requirements</h4>
      <ul>
        <li>8+ years in software engineering writing production-grade code.</li>
      </ul>
      <h4>Apply for this position</h4>
    </body>
  </html>
`

test('Coralogix helpers stay pinned to the verified first-party careers listing', async () => {
  const coralogix = await loadCoralogixModule()

  assert.equal(coralogix.CAREERS_URL, 'https://coralogix.com/careers/')
  assert.equal(coralogix.hasOfficialCareersSignal(listingHtml), true)
  assert.equal(coralogix.hasOfficialCareersSignal('<html><body>Unexpected</body></html>'), false)
  assert.deepEqual(coralogix.extractIndiaJobUrls(listingHtml), [
    'https://coralogix.com/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/',
    'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
    'https://coralogix.com/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/',
  ])
})

test('extractJobFromDetail maps first-party Coralogix India role pages into normalized jobs', async () => {
  const coralogix = await loadCoralogixModule()

  assert.deepEqual(
    coralogix.extractJobFromDetail(
      'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
      remoteEngineerHtml,
    ),
    {
      title: 'Cloud and Observability Engineer (Remote Role, 6pm - 3am)',
      company: 'Coralogix',
      department: null,
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
      jobId: 'careers-co-remote-india-4d.169-cloud-and-observability-engineer-remote-role-6pm-3am-all',
      requisitionId: 'careers-co-remote-india-4d.169-cloud-and-observability-engineer-remote-role-6pm-3am-all',
      sourceUrl: 'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
      applyUrl: 'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
      employmentType: 'Full-time',
      experienceRequired: 'Intermediate',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Design alerts and dashboards based on real-world customer use cases. Experience with scripting and automation.',
      remoteStatus: 'Remote',
    },
  )
})

test('run validates the verified Coralogix listing page and returns only India roles from first-party detail pages', async () => {
  const coralogix = await loadCoralogixModule()
  const requestedUrls = []

  const jobs = await coralogix.createCoralogixScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === coralogix.CAREERS_URL) return listingHtml
      if (url === 'https://coralogix.com/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/') return cloudEngineerHtml
      if (url === 'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/') return remoteEngineerHtml
      if (url === 'https://coralogix.com/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/') return forwardDeployedHtml

      throw new Error(`Unexpected Coralogix URL: ${url}`)
    },
    now: () => '2026-07-25T12:34:56.000Z',
  })

  assert.deepEqual(requestedUrls, [
    coralogix.CAREERS_URL,
    'https://coralogix.com/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/',
    'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
    'https://coralogix.com/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'coralogix')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-25T12:34:56.000Z')
  assert.equal(jobs[1].city, 'Remote')
  assert.equal(jobs[2].title, 'Forward Deployed Engineer')
})

test('run fails closed when the verified Coralogix listing or India detail pages drift', async () => {
  const coralogix = await loadCoralogixModule()

  await assert.rejects(
    coralogix.createCoralogixScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /verified coralogix careers page/i,
  )

  await assert.rejects(
    coralogix.createCoralogixScraper().run({
      fetchText: async (url) => {
        if (url === coralogix.CAREERS_URL) return listingHtml
        return '<html><body><h2>Unexpected detail page</h2></body></html>'
      },
    }),
    /india role detail pages changed materially/i,
  )
})
