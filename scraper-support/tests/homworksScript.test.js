import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scraper',
  'homworks',
  'fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadHomworksModule = async () => {
  try {
    return await import('../../scraper/homworks/script.js')
  } catch {
    assert.fail('Expected Homworks scraper module at ../../scraper/homworks/script.js')
  }
}

const currentCareersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers | Join Our Interior Design Team | Homworks</title>
  </head>
  <body>
    <nav>
      <a href="https://www.homworks.com/">Home</a>
      <a href="https://www.homworks.com/careers-homworks/">Careers</a>
    </nav>
    <main>
      <h1>CAREERS</h1>
      <p>Welcome to Homworks!</p>
      <p>
        If you're passionate about interior design, have a creative eye, and are looking for a
        challenging and rewarding career, we'd love to hear from you.
      </p>
      <h2>Apply Now</h2>
      <p>Take the Next Step in Your Career, Contact Us Today!</p>
      <label>Full Name*</label>
      <label>Email Address*</label>
      <label>Phone Number*</label>
      <label>Subject*</label>
      <button>Submit Details</button>
      <h3>Corporate Office</h3>
      <p>538/2, Airport Service Rd, Peelamedu, Alagu Nagar, Civil Aerodrome Post, Coimbatore – 641014</p>
      <p>Phone +91-8925811898 0422-4643862 1800 121 3110</p>
      <p>Email [email&#160;protected]</p>
      <p>HOMWORKS - STYLCOVE MODULARS PRIVATE LIMITED | Copyright 2026 | Homworks-Stylcove.</p>
    </main>
  </body>
</html>
`

test('extractSearchResults returns no jobs when Homworks only exposes a first-party apply form with no public listings', async () => {
  const homworks = await loadHomworksModule()
  const careersHtml = readFixture('careers-page.html')

  assert.equal(homworks.CAREERS_URL, 'https://www.homworks.com/careers-homworks/')
  assert.equal(homworks.HOMEPAGE_URL, 'https://www.homworks.com/')
  assert.equal(homworks.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(homworks.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(homworks.hasPublicJobBoardSignal(careersHtml), false)
  assert.deepEqual(homworks.extractSearchResults(careersHtml), [])
})

test('run validates the verified Homworks careers form surface and fails closed when a public jobs board appears', async () => {
  const homworks = await loadHomworksModule()
  const careersHtml = readFixture('careers-page.html')
  const publicJobsHtml = readFixture('public-jobs-page.html')

  const requestedUrls = []
  const jobs = await homworks.createHomworksScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === homworks.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Homworks fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [homworks.CAREERS_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    homworks.createHomworksScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /public job listings/i,
  )
})
