import assert from 'node:assert/strict'
import test from 'node:test'

const loadMolecularConnectionsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Molecular Connections</title>
    <meta
      name="description"
      content="Molecular Connections Private Limited is the pioneer In silico discovery services, founded by professionals with proven expertise in drug discovery."
    />
  </head>
  <body>
    <main>
      <div>Powered by AI &amp; 5,000+ Experts</div>
      <h1>Experience applied AI in research, data and scholarly communications</h1>
      <div>MC Group</div>
      <a href="https://career.molecularconnections.com/">Career</a>
    </main>
  </body>
</html>
`

const careersHomeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings:Career at Molecular Connections</title>
  </head>
  <body>
    <main>
      <h1>Ranked Best Place to Work!</h1>
      <a href="https://career.molecularconnections.com/technology-job-openings/">Current Openings</a>
      <a href="https://career.molecularconnections.com/job-openings/">Job Openings</a>
      <p>Discover your true potential today! Join us!</p>
    </main>
  </body>
</html>
`

const technologyOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technology Job Openings - Career at Molecular Connections</title>
  </head>
  <body>
    <main>
      <h1>Technology Job Openings!</h1>
      <p>Welcome to Molecular Connections Technology Job Openings page</p>
      <h2>Current Openings</h2>
      <p>Take a look at the open positions mentioned below and join our team of highly talented technology professionals.</p>
      <h2>JOB ROLE</h2>
      <h2>LOCATION</h2>
      <h2>POSTED ON</h2>

      <h2 data-post-link="https://career.molecularconnections.com/jobs/application-support-specialist-publishing-platforms/">
        Application Support Specialist - Publishing Platforms
      </h2>
      <p>Bengaluru</p>
      <p>February 1, 2026</p>

      <style>
        .elementor-job-card {
          border: 2px solid #481111;
          padding: 10px;
        }
      </style>

      <h2 data-post-link="https://career.molecularconnections.com/jobs/application-support-specialist-life-sciences-publishing-platforms/">
        Application Support Specialist - Life Sciences &amp; Publishing Platforms
      </h2>
      <p>Bengaluru</p>
      <p>August 7, 2025</p>

      <h2 data-post-link="https://career.molecularconnections.com/jobs/senior-python-developer/">
        Senior Python developer
      </h2>
      <p>Bengaluru</p>
      <p>January 29, 2025</p>
    </main>
  </body>
</html>
`

const applyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings - Career at Molecular Connections</title>
  </head>
  <body>
    <main>
      <h1>Job Openings</h1>
      <p>Thanks for checking out our job openings.</p>
      <p>If you donâ€™t see any open positions or relevant positions, please submit your resume below.</p>
      <label for="position">Position you are applying for</label>
      <input id="position" name="position" />
      <button type="submit">Apply</button>
    </main>
  </body>
</html>
`

test('Molecular Connections extracts the verified technology openings and routes apply traffic to the official form', async () => {
  const molecularConnections = await loadMolecularConnectionsModule()
  assert.ok(molecularConnections, 'Expected Molecular Connections scraper module at ./script.js')

  assert.equal(molecularConnections.SOURCE, 'molecularconnectionspvtltd')
  assert.equal(molecularConnections.COMPANY, 'Molecular Connections Pvt Ltd')
  assert.equal(molecularConnections.HOMEPAGE_URL, 'https://molecularconnections.com/')
  assert.equal(molecularConnections.CAREERS_HOME_URL, 'https://career.molecularconnections.com/')
  assert.equal(
    molecularConnections.TECHNOLOGY_OPENINGS_URL,
    'https://career.molecularconnections.com/technology-job-openings/',
  )
  assert.equal(
    molecularConnections.APPLY_URL,
    'https://career.molecularconnections.com/job-openings/',
  )
  assert.equal(molecularConnections.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(molecularConnections.hasOfficialCareersHomeSignal(careersHomeHtml), true)
  assert.equal(molecularConnections.hasOfficialApplyFormSignal(applyPageHtml), true)

  assert.deepEqual(molecularConnections.extractTechnologyOpenings(technologyOpeningsHtml), [
    {
      title: 'Application Support Specialist - Publishing Platforms',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      postingDate: '2026-02-01',
      sourceUrl: 'https://career.molecularconnections.com/jobs/application-support-specialist-publishing-platforms/',
      applyUrl: 'https://career.molecularconnections.com/job-openings/',
    },
    {
      title: 'Application Support Specialist - Life Sciences & Publishing Platforms',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      postingDate: '2025-08-07',
      sourceUrl: 'https://career.molecularconnections.com/jobs/application-support-specialist-life-sciences-publishing-platforms/',
      applyUrl: 'https://career.molecularconnections.com/job-openings/',
    },
    {
      title: 'Senior Python developer',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      postingDate: '2025-01-29',
      sourceUrl: 'https://career.molecularconnections.com/jobs/senior-python-developer/',
      applyUrl: 'https://career.molecularconnections.com/job-openings/',
    },
  ])
})

test('Molecular Connections run validates the verified public surfaces and decorates jobs', async () => {
  const molecularConnections = await loadMolecularConnectionsModule()
  assert.ok(molecularConnections, 'Expected Molecular Connections scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await molecularConnections.createMolecularConnectionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === molecularConnections.HOMEPAGE_URL) return homepageHtml
      if (url === molecularConnections.CAREERS_HOME_URL) return careersHomeHtml
      if (url === molecularConnections.TECHNOLOGY_OPENINGS_URL) return technologyOpeningsHtml
      if (url === molecularConnections.APPLY_URL) return applyPageHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    molecularConnections.HOMEPAGE_URL,
    molecularConnections.CAREERS_HOME_URL,
    molecularConnections.TECHNOLOGY_OPENINGS_URL,
    molecularConnections.APPLY_URL,
    'https://career.molecularconnections.com/jobs/application-support-specialist-publishing-platforms/',
    'https://career.molecularconnections.com/jobs/application-support-specialist-life-sciences-publishing-platforms/',
    'https://career.molecularconnections.com/jobs/senior-python-developer/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Molecular Connections Pvt Ltd')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'molecularconnectionspvtltd')
  assert.equal(jobs[0].link, molecularConnections.APPLY_URL)
  assert.match(jobs[0].jobId, /^molecularconnectionspvtltd-/)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Molecular Connections fails closed when the verified public careers surfaces change', async () => {
  const molecularConnections = await loadMolecularConnectionsModule()
  assert.ok(molecularConnections, 'Expected Molecular Connections scraper module at ./script.js')

  await assert.rejects(
    molecularConnections.createMolecularConnectionsScraper().run({
      fetchText: async (url) => {
        if (url === molecularConnections.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        return careersHomeHtml
      },
    }),
    /official public site/i,
  )

  await assert.rejects(
    molecularConnections.createMolecularConnectionsScraper().run({
      fetchText: async (url) => {
        if (url === molecularConnections.HOMEPAGE_URL) return homepageHtml
        if (url === molecularConnections.CAREERS_HOME_URL) return careersHomeHtml
        if (url === molecularConnections.TECHNOLOGY_OPENINGS_URL) {
          return `
            <html>
              <head><title>Technology Job Openings - Career at Molecular Connections</title></head>
              <body><main><h1>Technology Job Openings!</h1><h2>Current Openings</h2></main></body>
            </html>
          `
        }
        if (url === molecularConnections.APPLY_URL) return applyPageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public technology openings/i,
  )
})
