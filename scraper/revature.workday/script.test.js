import assert from 'node:assert/strict'
import test from 'node:test'

const loadRevatureModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Revature scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-Native Talent Transformation Platform | Revature</title>
  </head>
  <body>
    <nav>
      <a href="https://revature.wd1.myworkdayjobs.com/revaturecareers">Careers At Revature</a>
    </nav>
  </body>
</html>
`

test('buildScraperOptions keeps Revature on the verified official homepage handoff and Workday tenant', async () => {
  const revature = await loadRevatureModule()
  const options = revature.buildScraperOptions()

  assert.equal(revature.CAREER_PAGE_URL, 'https://www.revature.com/')
  assert.equal(revature.WORKDAY_BASE_URL, 'https://revature.wd1.myworkdayjobs.com/revaturecareers')
  assert.equal(revature.WORKDAY_DETAIL_URL_BASE, 'https://revature.wd1.myworkdayjobs.com/en-US/revaturecareers')
  assert.equal(revature.WORKDAY_JOBS_API_URL, 'https://revature.wd1.myworkdayjobs.com/wday/cxs/revature/revaturecareers/jobs')
  assert.equal(revature.COMPANY_NAME, 'Revature')
  assert.equal(revature.SOURCE, 'revature')
  assert.equal(revature.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.company, 'Revature')
  assert.equal(options.baseUrl, 'https://revature.wd1.myworkdayjobs.com/revaturecareers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'revature')
  assert.match(options.scraperDir, /revature\.workday$/)
})

test('Revature verifies the official homepage handoff before delegating to the shared Workday runner', async () => {
  const revature = await loadRevatureModule()
  const expectedJobs = [{ jobId: 'JR100155', title: 'QC Specialist - Data Specialist' }]
  const requestedUrls = []
  let receivedOptions = null

  const jobs = await revature.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialHomepageHtml
    },
    workdayRunner: async (options) => {
      receivedOptions = options
      return expectedJobs
    },
  })

  assert.equal(jobs, expectedJobs)
  assert.deepEqual(requestedUrls, ['https://www.revature.com/'])
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'Revature')
  assert.equal(receivedOptions.baseUrl, 'https://revature.wd1.myworkdayjobs.com/revaturecareers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'revature')
  assert.match(receivedOptions.scraperDir, /revature\.workday$/)
})

test('run fails closed when the official Revature homepage handoff changes', async () => {
  const revature = await loadRevatureModule()

  await assert.rejects(
    revature.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /official homepage surface changed/i,
  )

  await assert.rejects(
    revature.run({
      fetchText: async () => `
        <html>
          <head><title>AI-Native Talent Transformation Platform | Revature</title></head>
          <body>
            <a href="https://example.com/jobs">Careers At Revature</a>
          </body>
        </html>
      `,
      workdayRunner: async () => [],
    }),
    /verified workday handoff changed/i,
  )
})
