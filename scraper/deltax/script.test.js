import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDeltaXScraper,
  validateNoOpeningsPage,
} from './script.js'

const noOpeningsPage = `
  <main>
    <h2>Current Openings</h2>
    <h3>No Current Openings</h3>
  </main>
`

test('validates DeltaX Jobsoid no-openings page and returns no jobs', async () => {
  const requests = []
  const scraper = createDeltaXScraper()

  assert.equal(CAREER_PAGE_URL, 'https://deltax.jobsoid.com/')
  assert.equal(validateNoOpeningsPage(noOpeningsPage), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      return noOpeningsPage
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('rejects a DeltaX careers page that no longer has the expected no-openings shape', async () => {
  const scraper = createDeltaXScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<main><h2>Current Openings</h2></main>' }),
    /no longer exposes the expected no-openings page shape/,
  )
})
