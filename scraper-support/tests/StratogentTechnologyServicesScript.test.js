import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html>
  <head>
    <title>PTP India Careers: Grow Fast in Biotech &amp; Life Sciences IT</title>
  </head>
  <body>
    <h2>Opportunities at PTP / Stratogent: Build trusted life sciences cloud from India</h2>
    <p>We are an "always hiring" company, please drop us your resume.</p>
    <p>India: <a href="mailto:careers-india@stratogent.com">careers-india@stratogent.com</a></p>
    <p>Verification: <a href="mailto:verifications@stratogent.com">verifications@stratogent.com</a></p>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stratogenttechnologyservices/script.js')
  } catch {
    assert.fail('Expected Stratogent Technology Services scraper module at ../../scraper/stratogenttechnologyservices/script.js')
  }
}

test('Stratogent Technology Services helpers stay pinned to the verified email-only careers page', async () => {
  const stratogent = await loadScriptModule()

  assert.equal(stratogent.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.equal(stratogent.hasPublicJobsSignal(CAREERS_PAGE_HTML), false)
})

test('Stratogent Technology Services returns [] while the careers page stays email-only', async () => {
  const stratogent = await loadScriptModule()

  const jobs = await stratogent.createStratogentTechnologyServicesScraper().run({
    fetchText: async () => CAREERS_PAGE_HTML,
  })

  assert.deepEqual(jobs, [])
})

test('Stratogent Technology Services fails closed if public jobs appear', async () => {
  const stratogent = await loadScriptModule()

  await assert.rejects(
    stratogent.createStratogentTechnologyServicesScraper().run({
      fetchText: async () => `${CAREERS_PAGE_HTML}<section><h2>Current Openings</h2><a href="/jobs/cloud-platform-engineer">Apply now</a></section>`,
    }),
    /appears to expose public jobs/i,
  )
})
