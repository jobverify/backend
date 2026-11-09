import assert from 'node:assert/strict'
import test from 'node:test'

const loadSiliconLabsIndiaModule = async () => {
  try {
    return await import('../../scraper/siliconlabsindia.workday/script.js')
  } catch {
    assert.fail('Expected Silicon Labs India scraper module at ../../scraper/siliconlabsindia.workday/script.js')
  }
}

test('buildScraperOptions keeps Silicon Labs India on the official Silicon Labs careers page and Workday tenant', async () => {
  const siliconLabsIndia = await loadSiliconLabsIndiaModule()
  const options = siliconLabsIndia.buildScraperOptions()

  assert.equal(siliconLabsIndia.CAREER_PAGE_URL, 'https://www.silabs.com/about-us/careers')
  assert.equal(siliconLabsIndia.BASE_URL, 'https://silabs.wd1.myworkdayjobs.com/SiliconlabsCareers')
  assert.equal(siliconLabsIndia.COMPANY_NAME, 'Silicon Labs India')
  assert.equal(siliconLabsIndia.SOURCE, 'siliconlabsindia')
  assert.equal(options.company, 'Silicon Labs India')
  assert.equal(options.baseUrl, 'https://silabs.wd1.myworkdayjobs.com/SiliconlabsCareers')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'siliconlabsindia')
  assert.match(options.scraperDir, /siliconlabsindia\.workday$/)
})

test('run delegates Silicon Labs India scraping to the shared Workday runner with the official tenant options', async () => {
  const siliconLabsIndia = await loadSiliconLabsIndiaModule()
  const expectedJobs = [{ jobId: 'SL-1', title: 'Sample Job' }]
  let receivedOptions = null

  const jobs = await siliconLabsIndia.run({
    workdayRunner: async (options) => {
      receivedOptions = options
      return expectedJobs
    },
  })

  assert.equal(jobs, expectedJobs)
  assert.ok(receivedOptions)
  assert.equal(receivedOptions.company, 'Silicon Labs India')
  assert.equal(receivedOptions.baseUrl, 'https://silabs.wd1.myworkdayjobs.com/SiliconlabsCareers')
  assert.equal(receivedOptions.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(receivedOptions.source, 'siliconlabsindia')
  assert.match(receivedOptions.scraperDir, /siliconlabsindia\.workday$/)
})
