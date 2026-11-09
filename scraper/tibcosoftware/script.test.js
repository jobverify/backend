import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | TIBCO</title>
  </head>
  <body>
    <h1>Find your next JOB OPPORTUNITY</h1>
    <a href="https://careers.cloud.com/">Explore opportunities</a>
  </body>
</html>
`

const careersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Home - Cloud Software Group</title>
  </head>
  <body>
    <h1>Innovate and grow within Cloud Software Group</h1>
    <p>Search by job title, location, department, category, etc.</p>
    <h2>Inside Cloud Software Group</h2>
    <p>About us</p>
    <p>100 million users around the globe</p>
    <p>Ready to apply? Search for open roles.</p>
    <a href="https://careers.cloud.com/jobs/search">See all opportunities</a>
  </body>
</html>
`

const careersSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Search - Cloud Software Group</title>
  </head>
  <body>
    <h1>Find your next career opportunity</h1>
    <div>Country</div>
    <div>Brand</div>
    <div>India</div>
    <p>Non-TIBCO Office</p>
    <p>Citrix</p>
    <p>Cloud Software Group Corporate</p>
    <p>Spotfire</p>
    <a href="https://careers.cloud.com/jobs/example-role">Example job</a>
  </body>
</html>
`

const challengeHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>JavaScript is disabled</h1>
    <p>In order to continue, we need to verify that you're not a robot.</p>
  </body>
</html>
`

test('TIBCO recognizes the current official contact page and generic Cloud Software Group hub/search surfaces', async () => {
  const tibco = await loadModule()

  assert.equal(tibco.SOURCE, 'tibcosoftware')
  assert.equal(tibco.COMPANY, 'TIBCO Software')
  assert.equal(tibco.hasOfficialContactPageSignal(contactPageHtml), true)
  assert.equal(tibco.extractOfficialCareersHubUrl(contactPageHtml), 'https://careers.cloud.com/')
  assert.equal(tibco.hasGenericCloudCareersHubSignal(careersHubHtml), true)
  assert.equal(tibco.hasGenericCloudCareersSearchSignal(careersSearchHtml), true)
})

test('TIBCO run returns no jobs while the verified generic Cloud Software Group surfaces hold', async () => {
  const tibco = await loadModule()

  const requestedUrls = []
  const jobs = await tibco.createTibcoSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tibco.CAREERS_URL) return contactPageHtml
      if (url === tibco.CAREERS_HUB_URL) return careersHubHtml
      if (url === tibco.CAREERS_SEARCH_URL) return careersSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tibco.CAREERS_URL,
    tibco.CAREERS_HUB_URL,
    tibco.CAREERS_SEARCH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('TIBCO run falls back to a browser-backed hub fetch when the direct hub response is a JS challenge page', async () => {
  const tibco = await loadModule()

  const jobs = await tibco.createTibcoSoftwareScraper().run({
    fetchText: async (url) => {
      if (url === tibco.CAREERS_URL) return contactPageHtml
      if (url === tibco.CAREERS_HUB_URL) return challengeHtml
      if (url === tibco.CAREERS_SEARCH_URL) return careersSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      assert.equal(url, tibco.CAREERS_HUB_URL)
      return careersHubHtml
    },
  })

  assert.deepEqual(jobs, [])
})
