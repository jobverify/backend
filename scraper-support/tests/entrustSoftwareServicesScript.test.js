import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>eNTrust Software Services</title>
  </head>
  <body>
    <h1>eNTrust is a global business process outsourcing (KPO) company</h1>
    <h2>Get in touch</h2>
    <p>ADDRESS 1</p>
    <p>ADDRESS 2</p>
    <p>Quick Links About eNTrust Terms of Use</p>
    <p>info@ntrustinfotech.com</p>
  </body>
</html>
`

const homepageWithJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <article data-job-id="ent-001">
      <h2>Process Associate</h2>
      <a href="/careers/process-associate">Apply now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/entrustsoftwareservices/script.js')
  } catch {
    assert.fail('Expected eNTrust Software & Services scraper module at ../../scraper/entrustsoftwareservices/script.js')
  }
}

test('eNTrust Software & Services helpers stay pinned to the verified homepage without careers navigation or public jobs', async () => {
  const entrust = await loadModule()

  assert.equal(entrust.SOURCE, 'entrustsoftwareservices')
  assert.equal(entrust.COMPANY, 'eNTrust Software & Services')
  assert.equal(entrust.HOMEPAGE_URL, 'https://www.entrustsoft.in/')
  assert.equal(entrust.VERIFIED_ON, '2026-07-17')
  assert.equal(entrust.hasVerifiedHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(entrust.hasCareerNavigationSignal(verifiedHomepageHtml), false)
  assert.equal(entrust.hasPublicJobListingSignal(verifiedHomepageHtml), false)
  assert.equal(entrust.hasPublicJobListingSignal(homepageWithJobsHtml), true)
})

test('eNTrust Software & Services returns no jobs while the verified homepage still lacks careers navigation and public openings', async () => {
  const entrust = await loadModule()
  const requestedUrls = []

  const jobs = await entrust.createEntrustSoftwareServicesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedHomepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [entrust.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('eNTrust Software & Services fails closed when the homepage drifts or starts exposing public jobs', async () => {
  const entrust = await loadModule()

  await assert.rejects(
    entrust.createEntrustSoftwareServicesScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified eNTrust homepage/i,
  )

  await assert.rejects(
    entrust.createEntrustSoftwareServicesScraper().run({
      fetchText: async () => homepageWithJobsHtml,
    }),
    /public jobs/i,
  )
})
