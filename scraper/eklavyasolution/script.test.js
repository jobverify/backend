import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_CANDIDATE_PATHS,
  COMPANY,
  HOMEPAGE_URL,
  createEklavyaSolutionScraper,
  hasOfficialBundleSignal,
  hasOfficialHomepageSignal,
  pageExposesPublicJobListings,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Drona</title>
      <script type="module" crossorigin src="/assets/index-Dyj_Lf4D.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const bundleJs = `
  const company = "EklavyaSolution Hsaka Technologies Pvt Ltd";
  const email = "support@eklavyasolution.com";
  const demoPath = "/api/demo";
  const subscribePath = "/api/subscribe";
`

const noJobsShellHtml = homepageHtml

const jobsPageHtml = `
  <html>
    <head>
      <title>Drona Careers</title>
    </head>
    <body>
      <div id="root"></div>
      <section>
        <h1>Job Openings</h1>
        <a href="/careers/software-engineer">Apply Now</a>
      </section>
    </body>
  </html>
`

test('recognizes the verified Eklavya Solution official homepage, bundle, and no-listings pages', () => {
  assert.equal(COMPANY, 'EKLAVYA SOLUTION')
  assert.equal(HOMEPAGE_URL, 'https://eklavyasolution.com/')
  assert.deepEqual(CAREERS_CANDIDATE_PATHS, ['/careers', '/career', '/jobs', '/apply'])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialBundleSignal(bundleJs), true)
  assert.equal(pageExposesPublicJobListings(noJobsShellHtml), false)
  assert.equal(pageExposesPublicJobListings(jobsPageHtml), true)
})

test('run returns [] only when the official Eklavya Solution site shape is valid and candidate job pages show no public listings', async () => {
  const requestedUrls = []

  const jobs = await createEklavyaSolutionScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return {
          ok: true,
          status: 200,
          url,
          text: homepageHtml,
        }
      }

      if (url === 'https://eklavyasolution.com/assets/index-Dyj_Lf4D.js') {
        return {
          ok: true,
          status: 200,
          url,
          text: bundleJs,
        }
      }

      return {
        ok: true,
        status: 200,
        url,
        text: noJobsShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://eklavyasolution.com/',
    'https://eklavyasolution.com/assets/index-Dyj_Lf4D.js',
    'https://eklavyasolution.com/careers',
    'https://eklavyasolution.com/career',
    'https://eklavyasolution.com/jobs',
    'https://eklavyasolution.com/apply',
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage no longer matches the verified Eklavya Solution site', async () => {
  await assert.rejects(
    createEklavyaSolutionScraper().run({
      fetchPage: async () => ({
        ok: true,
        status: 200,
        url: HOMEPAGE_URL,
        text: '<html><title>Holding page</title><body>Welcome</body></html>',
      }),
    }),
    /official Eklavya Solution website/i,
  )
})

test('run fails closed when the official bundle no longer matches the verified public brand signals', async () => {
  await assert.rejects(
    createEklavyaSolutionScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === HOMEPAGE_URL ? homepageHtml : 'const company = "Other";',
      }),
    }),
    /frontend bundle/i,
  )
})

test('run fails closed when a candidate public careers page begins exposing jobs', async () => {
  await assert.rejects(
    createEklavyaSolutionScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === HOMEPAGE_URL ? homepageHtml : (url.endsWith('.js') ? bundleJs : jobsPageHtml),
      }),
    }),
    /public job listings/i,
  )
})
