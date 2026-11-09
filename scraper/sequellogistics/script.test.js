import assert from 'node:assert/strict'
import test from 'node:test'

const loadSequelModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sequel Global</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Current Openings</h2>
      <a href="field-staff">Field Hiring</a>
      <a href="lateral-staff">Lateral Hiring</a>
      <a href="fresher">Fresher Hiring</a>
      <p>Life at Sequel</p>
    </main>
  </body>
</html>
`

const lateralHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sequel Global</title>
  </head>
  <body>
    <section>
      <h2>Be part of a growth journey.</h2>
      <h3>Lateral Hiring</h3>
      <div class="col-lg-4 col-md-4 col-sm-12">
        <div class="mb-3 hiring-box-bg">
          <div class="inner-box">
            <div class="lower-content">
              <h4>Management Trainee - Corporate Sales</h4>
              <table class="hiring-detail-table">
                <tr><td>Published Date: 03-03-2022</td></tr>
                <tr><td>Department: Account</td></tr>
                <tr><td>Location: Bengaluru</td></tr>
              </table>
              <div class="btn-readmore-box text-right">
                <a href="lateral-hiring-detail" class="theme-btn read-more">Apply</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-4 col-sm-12">
        <div class="mb-3 hiring-box-bg">
          <div class="inner-box">
            <div class="lower-content">
              <h4>Management Trainee - Operations</h4>
              <table class="hiring-detail-table">
                <tr><td>Published Date: 03-03-2022</td></tr>
                <tr><td>Department: Account</td></tr>
                <tr><td>Location: Bengaluru</td></tr>
              </table>
              <div class="btn-readmore-box text-right">
                <a href="lateral-hiring-detail" class="theme-btn read-more">Apply</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-4 col-sm-12">
        <div class="mb-3 hiring-box-bg">
          <div class="inner-box">
            <div class="lower-content">
              <h4>Management Trainee - Human Resources</h4>
              <table class="hiring-detail-table">
                <tr><td>Published Date: 03-03-2022</td></tr>
                <tr><td>Department: Account</td></tr>
                <tr><td>Location: Bengaluru</td></tr>
              </table>
              <div class="btn-readmore-box text-right">
                <a href="lateral-hiring-detail" class="theme-btn read-more">Apply</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

test('Sequel Logistics recognizes the verified first-party careers landing page and lateral openings page', async () => {
  const sequel = await loadSequelModule()
  assert.ok(sequel, 'Expected scraper module at ./script.js')

  assert.equal(sequel.SOURCE, 'sequellogistics')
  assert.equal(sequel.COMPANY, 'Sequel Logistics')
  assert.equal(sequel.COMPANY_DOMAIN, 'sequelglobal.com')
  assert.equal(sequel.CAREERS_URL, 'https://www.sequelglobal.com/career.html')
  assert.equal(sequel.LATERAL_HIRING_URL, 'https://www.sequelglobal.com/lateral-staff')
  assert.equal(sequel.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(sequel.hasOfficialLateralHiringSignal(lateralHtml), true)
})

test('extractLateralJobs parses the three public lateral openings from the verified first-party page', async () => {
  const sequel = await loadSequelModule()
  assert.ok(sequel, 'Expected scraper module at ./script.js')

  assert.deepEqual(
    sequel.extractLateralJobs(lateralHtml).map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'Management Trainee - Corporate Sales',
        department: 'Account',
        location: 'Bengaluru',
        city: 'Bengaluru',
        jobId: 'management-trainee-corporate-sales',
        sourceUrl: 'https://www.sequelglobal.com/lateral-staff',
        applyUrl: 'https://www.sequelglobal.com/lateral-staff',
        postingDate: '2022-03-03',
      },
      {
        title: 'Management Trainee - Operations',
        department: 'Account',
        location: 'Bengaluru',
        city: 'Bengaluru',
        jobId: 'management-trainee-operations',
        sourceUrl: 'https://www.sequelglobal.com/lateral-staff',
        applyUrl: 'https://www.sequelglobal.com/lateral-staff',
        postingDate: '2022-03-03',
      },
      {
        title: 'Management Trainee - Human Resources',
        department: 'Account',
        location: 'Bengaluru',
        city: 'Bengaluru',
        jobId: 'management-trainee-human-resources',
        sourceUrl: 'https://www.sequelglobal.com/lateral-staff',
        applyUrl: 'https://www.sequelglobal.com/lateral-staff',
        postingDate: '2022-03-03',
      },
    ],
  )
})

test('defaultFetchText falls back to the source-local TLS bypass only for the verified Sequel Global certificate failure', async () => {
  const sequel = await loadSequelModule()
  assert.ok(sequel, 'Expected scraper module at ./script.js')

  let insecureFetchCalled = false
  const html = await sequel.defaultFetchText(sequel.CAREERS_URL, {
    fetchImpl: async () => {
      const cause = new Error('unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca')
      throw Object.assign(new Error('fetch failed'), { cause })
    },
    insecureFetchTextImpl: async (url, options) => {
      insecureFetchCalled = true
      assert.equal(url, sequel.CAREERS_URL)
      assert.equal(options.timeoutMs, 25)
      return careersHtml
    },
    timeoutMs: 25,
  })

  assert.equal(html, careersHtml)
  assert.equal(insecureFetchCalled, true)
})

test('Sequel Logistics scraper returns the public lateral openings from the verified first-party careers surface', async () => {
  const sequel = await loadSequelModule()
  assert.ok(sequel, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await sequel.createSequelLogisticsScraper({
    now: () => '2026-08-04T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sequel.CAREERS_URL) return careersHtml
      if (url === sequel.LATERAL_HIRING_URL) return lateralHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sequel.CAREERS_URL,
    sequel.LATERAL_HIRING_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      remoteStatus: job.remoteStatus,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Management Trainee - Corporate Sales',
        company: 'Sequel Logistics',
        source: 'sequellogistics',
        link: 'https://www.sequelglobal.com/lateral-staff',
        remoteStatus: 'On-site',
        scrapedAt: '2026-08-04T12:00:00.000Z',
      },
      {
        title: 'Management Trainee - Human Resources',
        company: 'Sequel Logistics',
        source: 'sequellogistics',
        link: 'https://www.sequelglobal.com/lateral-staff',
        remoteStatus: 'On-site',
        scrapedAt: '2026-08-04T12:00:00.000Z',
      },
      {
        title: 'Management Trainee - Operations',
        company: 'Sequel Logistics',
        source: 'sequellogistics',
        link: 'https://www.sequelglobal.com/lateral-staff',
        remoteStatus: 'On-site',
        scrapedAt: '2026-08-04T12:00:00.000Z',
      },
    ],
  )
})

test('Sequel Logistics scraper fails closed when the verified public careers surface drifts', async () => {
  const sequel = await loadSequelModule()
  assert.ok(sequel, 'Expected scraper module at ./script.js')

  await assert.rejects(
    sequel.createSequelLogisticsScraper().run({
      fetchText: async (url) => {
        if (url === sequel.CAREERS_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers landing page/i,
  )

  await assert.rejects(
    sequel.createSequelLogisticsScraper().run({
      fetchText: async (url) => {
        if (url === sequel.CAREERS_URL) return careersHtml
        if (url === sequel.LATERAL_HIRING_URL) return '<html><body><h1>Lateral Hiring</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified lateral openings page/i,
  )
})
