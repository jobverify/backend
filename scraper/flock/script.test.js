import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createFlockScraper,
  extractHomepageCareersUrl,
  hasNoPublicJobsShellSignal,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Team Messenger &amp; Online Collaboration Platform – Flock</title>
    </head>
    <body>
      <p>Team Messenger</p>
      <p>Online Collaboration Platform</p>
      <p>Flock</p>
      <p>Sign In</p>
      <a href="http://careers.flock.com/">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Flock Careers</title>
    </head>
    <body>
      <p>changing how teams communicate and work together</p>
      <p>Join the Team</p>
      <p>All teams</p>
      <p>All locations</p>
      <p>Search Jobs</p>
      <p>work@flock.com</p>
      <p>Why join Flock</p>
      <p>Our Culture</p>
      <p>Benefits and Perks</p>
    </body>
  </html>
`

test('Flock accepts the current homepage careers handoff and relaxed careers-page copy', () => {
  assert.equal(extractHomepageCareersUrl(homepageHtml), 'https://careers.flock.com/')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasNoPublicJobsShellSignal(careersHtml), true)
})

test('Flock run returns [] while the homepage and careers shell still match the verified no-public-jobs surface', async () => {
  const requestedUrls = []

  const jobs = await createFlockScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
})
