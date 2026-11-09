import assert from 'node:assert/strict'
import test from 'node:test'

const loadScriptModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Snyk scraper module at ./script.js')
  }
}

const careersHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Careers | Snyk</title>
      <link rel="canonical" href="https://snyk.io/careers/" />
      <meta name="description" content="Secure your future with Snyk." />
    </head>
    <body>
      <h1>Join us on our mission to help organizations build securely</h1>
      <a href="/careers/all-jobs/">See open jobs</a>
    </body>
  </html>
`

const jobsPageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Open jobs | Snyk</title>
      <link rel="canonical" href="https://snyk.io/careers/all-jobs/" />
    </head>
    <body>
      <div id="all-jobs"></div>
      <a href="https://jobs.ashbyhq.com/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c/507a3707-d6bd-48c4-800f-429ecf40769e">Security Engineer</a>
      <p>Open security, developer, sales, marketing, leadership, technical support, and creative roles at Snyk.</p>
    </body>
  </html>
`

const JOB_ID = '507a3707-d6bd-48c4-800f-429ecf40769e'
const BOARD_URL = 'https://jobs.ashbyhq.com/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c'
const jobsPayload = {
  apiVersion: '1',
  jobs: [{
    id: JOB_ID,
    title: 'Security Engineer',
    department: 'R&D',
    location: 'United States - Boston Office',
    address: { postalAddress: { addressCountry: 'United States' } },
    secondaryLocations: [],
    isListed: true,
    jobUrl: `${BOARD_URL}/${JOB_ID}`,
    applyUrl: `${BOARD_URL}/${JOB_ID}/application`,
  }],
}

test('Snyk scraper returns an empty India slice when the linked Ashby board has no India roles', async () => {
  const snyk = await loadScriptModule()
  const requested = []
  const scraper = snyk.createSnykScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === 'https://snyk.io/careers/') return careersHtml
      if (url === 'https://snyk.io/careers/all-jobs/') return jobsPageHtml
      throw new Error(`Unexpected HTML fetch: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push(url)
      assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c')
      return jobsPayload
    },
  })

  assert.deepEqual(requested, [
    'https://snyk.io/careers/',
    'https://snyk.io/careers/all-jobs/',
    'https://api.ashbyhq.com/posting-api/job-board/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c',
  ])
  assert.deepEqual(jobs, [])
})

test('Snyk scraper rejects payloads that no longer match the linked Ashby board contract', async () => {
  const snyk = await loadScriptModule()
  const scraper = snyk.createSnykScraper()

  await assert.rejects(
    () => scraper.run({
      fetchText: async (url) => {
        if (url === 'https://snyk.io/careers/') return careersHtml
        if (url === 'https://snyk.io/careers/all-jobs/') return jobsPageHtml
        throw new Error(`Unexpected HTML fetch: ${url}`)
      },
      fetchJson: async () => ({ apiVersion: '1', jobs: null }),
    }),
    /Snyk Ashby inventory changed materially/i,
  )
})
