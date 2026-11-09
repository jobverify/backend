import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDrutNetworksScraper,
  validateNoOpeningsPage,
} from './script.js'

const officialHomepageWithoutJobs = `
  <html>
    <head><title>Drut</title></head>
    <body>
      <div class="footer-menu">
        <a>HOME</a><a>ABOUT DRUT</a><a>ABOUT US</a><a>RESOURCES</a>
        <a>BLOGS</a><a>SURVEY</a><a>MEDIA</a>
      </div>
      <main>
        <h2>FIND A DRUT</h2>
        <p>Risk | Automate | Compliance</p>
        <h3>WHAT IS DRUT?</h3>
        <p>drut. is a robotics-based automation GRC platform.</p>
        <a>CONTACT US</a>
      </main>
      <footer>Copyright © 2026 - drut | All Rights Reserved</footer>
    </body>
  </html>
`

test('validates the official Drut public site with no careers listings and returns no jobs', async () => {
  const requestedUrls = []
  const scraper = createDrutNetworksScraper()

  assert.equal(CAREER_PAGE_URL, 'https://drut.com/')
  assert.equal(validateNoOpeningsPage(officialHomepageWithoutJobs), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialHomepageWithoutJobs
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('rejects a Drut page that does not match the verified public site shape', async () => {
  const scraper = createDrutNetworksScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<main><h1>Careers</h1></main>' }),
    /no longer exposes the expected no-openings page shape/,
  )
})
