import assert from 'node:assert/strict'
import test from 'node:test'

const loadMavenirModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Mavenir scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>
		MAVENIR: TELCO-FIRST. CLOUD-NATIVE. AI-BY-DESIGN.
    </title>
  </head>
  <body>
    <a href="https://www.mavenir.com/about/careers/">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>
		Careers - Mavenir
    </title>
  </head>
  <body>
    <a href="https://mavenir.wd1.myworkdayjobs.com/Mavenir_Careers">explore opportunities</a>
  </body>
</html>
`

test('buildScraperOptions keeps Mavenir on the verified careers handoff and Workday tenant', async () => {
  const mavenir = await loadMavenirModule()
  const options = mavenir.buildScraperOptions()

  assert.equal(mavenir.SOURCE, 'mavenir')
  assert.equal(mavenir.COMPANY_NAME, 'Mavenir')
  assert.equal(mavenir.CAREER_PAGE_URL, 'https://www.mavenir.com/')
  assert.equal(mavenir.CAREERS_PAGE_URL, 'https://www.mavenir.com/about/careers/')
  assert.equal(mavenir.WORKDAY_BASE_URL, 'https://mavenir.wd1.myworkdayjobs.com/Mavenir_Careers')
  assert.equal(mavenir.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.company, 'Mavenir')
  assert.equal(options.baseUrl, 'https://mavenir.wd1.myworkdayjobs.com/Mavenir_Careers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'mavenir')
  assert.match(options.scraperDir, /mavenir\.workday$/)
})

test('Mavenir verifies the homepage and careers handoff before delegating to the shared Workday runner', async () => {
  const mavenir = await loadMavenirModule()
  const expectedJobs = [{ jobId: 'R-12345', title: 'Software Engineer' }]
  const requestedUrls = []
  let receivedOptions = null

  const jobs = await mavenir.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mavenir.CAREER_PAGE_URL) return homepageHtml
      if (url === 'https://www.mavenir.com/about/careers/') return careersHtml
      return homepageHtml
    },
    workdayRunner: async (options) => {
      receivedOptions = options
      return expectedJobs
    },
  })

  assert.equal(jobs, expectedJobs)
  assert.deepEqual(requestedUrls, [
    'https://www.mavenir.com/',
    'https://www.mavenir.com/about/careers/',
  ])
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'Mavenir')
  assert.equal(receivedOptions.baseUrl, 'https://mavenir.wd1.myworkdayjobs.com/Mavenir_Careers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'mavenir')
  assert.match(receivedOptions.scraperDir, /mavenir\.workday$/)
})

test('run fails closed when the verified Mavenir homepage or Workday handoff changes', async () => {
  const mavenir = await loadMavenirModule()

  await assert.rejects(
    mavenir.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /official homepage surface changed/i,
  )

  await assert.rejects(
    mavenir.run({
      fetchText: async (url) => {
        if (url === mavenir.CAREER_PAGE_URL) return homepageHtml
        return `
          <html>
            <head>
              <title>Careers - Mavenir</title>
            </head>
            <body>
              <a href="https://mavenir.wd1.myworkdayjobs.com/Example_Careers">explore opportunities</a>
            </body>
          </html>
        `
      },
      workdayRunner: async () => [],
    }),
    /verified workday handoff changed/i,
  )
})
