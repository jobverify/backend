import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  createGeHealthCareScraper,
} from '../../scraper/gehealthcare/script.js'

const officialCareersHtml = `
  <html>
    <head><title>Careers at GE HealthCare | GE HealthCare jobs</title></head>
    <body>
      <h1>Create the future of healthcare</h1>
      <a href="/global/en/search-results">Search Jobs</a>
    </body>
  </html>
`

test('run validates the official GE HealthCare careers surface and returns no unverified listings', async () => {
  const requestedUrls = []

  const jobs = await createGeHealthCareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run rejects a page that does not match the official GE HealthCare careers surface', async () => {
  await assert.rejects(
    createGeHealthCareScraper().run({
      fetchText: async () => '<html><body>Unknown site</body></html>',
    }),
    /official GE HealthCare careers surface/i,
  )
})
