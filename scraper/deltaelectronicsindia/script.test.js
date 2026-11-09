import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDeltaElectronicsIndiaScraper,
  validateNoOpeningsPage,
} from './script.js'

const applicationPage = `
  <main>
    <h1>Let's Create a Better Tomorrow to Careers</h1>
    <nav><a href="/en-IN/career/Jobs">Jobs</a></nav>
    <form action="/en-IN/career/Jobs-Application">
      <input name="firstName" />
      <input name="lastName" />
      <label><input type="checkbox" /> please read and accept Privacy</label>
      <button type="submit">Submit</button>
    </form>
  </main>
`

test('validates Delta Electronics India application-only careers page and returns no jobs', async () => {
  const requestedUrls = []
  const scraper = createDeltaElectronicsIndiaScraper()

  assert.equal(CAREER_PAGE_URL, 'https://www.deltaelectronicsindia.com/en-IN/career/Jobs-Application')
  assert.equal(validateNoOpeningsPage(applicationPage), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return applicationPage
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('rejects a Delta Electronics India careers page without the application-only shape', async () => {
  const scraper = createDeltaElectronicsIndiaScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<main><h1>Careers</h1></main>' }),
    /no longer exposes the expected no-openings page shape/,
  )
})
