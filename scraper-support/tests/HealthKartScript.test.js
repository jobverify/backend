import assert from 'node:assert/strict'
import test from 'node:test'

const genericCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buy Health &amp; Bodybuilding Supplements Online - Healthkart</title>
  </head>
  <body>
    <section>
      <h2>About HealthKart</h2>
      <a href="/careers">Careers</a>
    </section>
    <nav>
      <a href="/brand-directory">Brand Directory</a>
      <a href="/sell-on-healthkart">Sell On HealthKart</a>
    </nav>
    <footer>
      <p>Copyright © 2026, healthkart.com</p>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HealthKart Jobs</title>
  </head>
  <body>
    <a href="/apply/senior-software-engineer">Apply Now</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Senior Software Engineer" }
    </script>
  </body>
</html>
`

const loadHealthKartModule = async () => {
  try {
    return await import('../../scraper/healthkart/script.js')
  } catch {
    assert.fail('Expected HealthKart scraper module at ../../scraper/healthkart/script.js')
  }
}

test('HealthKart sentinel constants stay pinned to the verified generic careers page contract', async () => {
  const healthKart = await loadHealthKartModule()

  assert.equal(healthKart.SOURCE, 'healthkart')
  assert.equal(healthKart.COMPANY, 'HealthKart')
  assert.equal(healthKart.OFFICIAL_BRAND_NAME, 'HealthKart')
  assert.equal(healthKart.CAREERS_URL, 'https://www.healthkart.com/careers')
  assert.equal(healthKart.COMPANY_DOMAIN, 'healthkart.com')
  assert.equal(healthKart.VERIFIED_ON, '2026-07-16')
  assert.equal(healthKart.hasVerifiedHealthKartCareersSignal(genericCareersHtml), true)
  assert.equal(healthKart.hasPublicHealthKartJobSignals(genericCareersHtml), false)
  assert.equal(healthKart.hasPublicHealthKartJobSignals(publicJobsHtml), true)
})

test('HealthKart returns [] only while the official careers route remains a non-listing commerce page', async () => {
  const healthKart = await loadHealthKartModule()
  const requestedUrls = []

  const jobs = await healthKart.createHealthKartScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === healthKart.CAREERS_URL) return genericCareersHtml
      throw new Error(`Unexpected HealthKart URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [healthKart.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('HealthKart fails closed when the official careers route drifts into a public jobs surface', async () => {
  const healthKart = await loadHealthKartModule()

  await assert.rejects(
    healthKart.createHealthKartScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /public jobs surface/i,
  )
})
