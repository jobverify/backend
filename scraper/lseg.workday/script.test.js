import assert from 'node:assert/strict'
import test from 'node:test'

const loadLsegModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected LSEG scraper module at ./script.js')
  }
}

test('buildScraperOptions keeps LSEG on the verified official careers handoff and Workday tenant', async () => {
  const lseg = await loadLsegModule()
  const options = lseg.buildScraperOptions()

  assert.equal(lseg.CAREER_PAGE_URL, 'https://www.lseg.com/en/careers')
  assert.equal(lseg.BASE_URL, 'https://lseg.wd3.myworkdayjobs.com/Careers')
  assert.equal(lseg.COMPANY_NAME, 'London Stock Exchange Group (LSEG)')
  assert.equal(lseg.SOURCE, 'lseg')
  assert.equal(options.company, 'London Stock Exchange Group (LSEG)')
  assert.equal(options.baseUrl, 'https://lseg.wd3.myworkdayjobs.com/Careers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'lseg')
  assert.match(options.scraperDir, /lseg\.workday$/)
})

test('run delegates LSEG scraping to the shared Workday runner with the verified tenant options', async () => {
  const lseg = await loadLsegModule()
  const expectedJobs = [{ jobId: 'R0121535', title: 'Sample LSEG Role' }]
  let receivedOptions = null

  const jobs = await lseg.run({
    workdayRunner: async (options) => {
      receivedOptions = options
      return expectedJobs
    },
  })

  assert.equal(jobs, expectedJobs)
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'London Stock Exchange Group (LSEG)')
  assert.equal(receivedOptions.baseUrl, 'https://lseg.wd3.myworkdayjobs.com/Careers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'lseg')
  assert.match(receivedOptions.scraperDir, /lseg\.workday$/)
})
