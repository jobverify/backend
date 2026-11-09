import assert from 'node:assert/strict'
import test from 'node:test'

const loadGxpTechnologiesModule = async () => {
  try {
    return await import('../../scraper/gxptechnologiesindiapvtltd/script.js')
  } catch {
    assert.fail('Expected GxP Technologies India Pvt. Ltd. scraper module at ../../scraper/gxptechnologiesindiapvtltd/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Shihan GX™ — Operator Execution Intelligence | GxP Technologies</title>
  </head>
  <body>
    <div id="root">
      <h1>GxP Technologies</h1>
      <p>Shihan GX™ — reduce recurring GMP execution errors without replacing your validated systems.</p>
      <p>Up to 75% fewer QC execution errors in a biopharma method</p>
      <p>$4M+ in manufacturing-error savings previously achieved</p>
      <p>Contact support@gxptechnologies.com</p>
    </div>
    <script type="module" src="/assets/main-C_TY3xCS.js"></script>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | GxP Technologies</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.ashbyhq.com/gxptechnologies/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('GxP Technologies India Pvt. Ltd. validates the verified first-party marketing shell and checked no-jobs routes', async () => {
  const gxpTechnologies = await loadGxpTechnologiesModule()

  assert.equal(gxpTechnologies.SOURCE, 'gxptechnologiesindiapvtltd')
  assert.equal(gxpTechnologies.COMPANY, 'GxP Technologies India Pvt. Ltd.')
  assert.equal(gxpTechnologies.HOMEPAGE_URL, 'https://gxptechnologies.com/')
  assert.deepEqual(gxpTechnologies.CHECKED_ROUTE_URLS, [
    'https://gxptechnologies.com/careers',
    'https://gxptechnologies.com/careers/',
    'https://gxptechnologies.com/career',
    'https://gxptechnologies.com/career/',
    'https://gxptechnologies.com/jobs',
    'https://gxptechnologies.com/jobs/',
    'https://gxptechnologies.com/company/careers',
  ])
  assert.equal(gxpTechnologies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(gxpTechnologies.extractBundlePath(homepageHtml), '/assets/main-C_TY3xCS.js')
  assert.equal(gxpTechnologies.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    gxpTechnologies.routeMatchesVerifiedShell(homepageHtml, '/assets/main-C_TY3xCS.js'),
    true,
  )
  assert.equal(
    gxpTechnologies.routeMatchesVerifiedShell(publicJobsHtml, '/assets/main-C_TY3xCS.js'),
    false,
  )
})

test('GxP Technologies India Pvt. Ltd. returns no jobs only while the verified first-party routes stay on the same marketing shell', async () => {
  const gxpTechnologies = await loadGxpTechnologiesModule()
  const requestedUrls = []

  const jobs = await gxpTechnologies.createGxpTechnologiesIndiaPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [
    gxpTechnologies.HOMEPAGE_URL,
    ...gxpTechnologies.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('GxP Technologies India Pvt. Ltd. fails closed when the homepage shell changes or a checked route starts exposing public jobs', async () => {
  const gxpTechnologies = await loadGxpTechnologiesModule()

  await assert.rejects(
    gxpTechnologies.createGxpTechnologiesIndiaPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === gxpTechnologies.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return homepageHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    gxpTechnologies.createGxpTechnologiesIndiaPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === gxpTechnologies.HOMEPAGE_URL) return homepageHtml
        if (url === gxpTechnologies.CHECKED_ROUTE_URLS[0]) return publicJobsHtml
        return homepageHtml
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
