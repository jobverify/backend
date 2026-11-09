import assert from 'node:assert/strict'
import test from 'node:test'

const loadImegModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected IMEG scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Design Consulting Jobs - IMEG</title>
    <link rel="canonical" href="https://imegcorp.com/careers/">
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Looking for your niche? We can help with that!</h2>
      <a class="btn btn-red" href="https://wd1.myworkdaysite.com/recruiting/imeg/Imeg_Careers">
        View job opportunities.
      </a>
    </main>
  </body>
</html>
`

test('buildScraperOptions keeps IMEG on the verified official careers handoff and Workday tenant', async () => {
  const imeg = await loadImegModule()
  const options = imeg.buildScraperOptions()

  assert.equal(imeg.CAREER_PAGE_URL, 'https://imegcorp.com/careers/')
  assert.equal(imeg.WORKDAY_BASE_URL, 'https://wd1.myworkdaysite.com/recruiting/imeg/Imeg_Careers')
  assert.equal(imeg.WORKDAY_DETAIL_URL_BASE, 'https://wd1.myworkdaysite.com/en-US/recruiting/imeg/Imeg_Careers')
  assert.equal(imeg.WORKDAY_JOBS_API_URL, 'https://wd1.myworkdaysite.com/wday/cxs/imeg/Imeg_Careers/jobs')
  assert.equal(imeg.COMPANY_NAME, 'IMEG')
  assert.equal(imeg.SOURCE, 'imeg')
  assert.equal(imeg.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.company, 'IMEG')
  assert.equal(options.baseUrl, 'https://wd1.myworkdaysite.com/recruiting/imeg/Imeg_Careers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'imeg')
  assert.match(options.scraperDir, /imeg\.workday$/)
})

test('IMEG verifies the official careers handoff before delegating to the shared Workday runner', async () => {
  const imeg = await loadImegModule()
  const expectedJobs = [{ jobId: 'JR-1001', title: 'Mechanical Engineer' }]
  const requestedUrls = []
  let receivedOptions = null

  const jobs = await imeg.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    workdayRunner: async (options) => {
      receivedOptions = options
      return expectedJobs
    },
  })

  assert.equal(jobs, expectedJobs)
  assert.deepEqual(requestedUrls, ['https://imegcorp.com/careers/'])
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'IMEG')
  assert.equal(receivedOptions.baseUrl, 'https://wd1.myworkdaysite.com/recruiting/imeg/Imeg_Careers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'imeg')
  assert.match(receivedOptions.scraperDir, /imeg\.workday$/)
})

test('run fails closed when the official IMEG careers handoff changes', async () => {
  const imeg = await loadImegModule()

  await assert.rejects(
    imeg.run({
      fetchText: async () => '<html><body><h1>Join us</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /official careers surface changed/i,
  )

  await assert.rejects(
    imeg.run({
      fetchText: async () => `
        <html>
          <head><title>Design Consulting Jobs - IMEG</title></head>
          <body>
            <h1>Careers</h1>
            <a href="https://example.com/jobs">View job opportunities.</a>
          </body>
        </html>
      `,
      workdayRunner: async () => [],
    }),
    /verified workday handoff changed/i,
  )
})
