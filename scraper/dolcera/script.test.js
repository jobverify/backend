import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDolceraScraper,
  validateNoOpeningsPage,
} from './script.js'

const officialNoOpeningsPage = `
  <html>
    <head>
      <title>Dolcera</title>
      <link rel="canonical" href="https://dolcera.com" />
      <meta name="author" content="Dolcera" />
    </head>
    <body>
      <nav aria-label="Primary">
        <a href="#services">Services</a>
        <a href="#leadership">Team</a>
        <a href="#contact">Contact</a>
      </nav>
      <main>
        <h1>Dolcera is an AI-native IP services firm.</h1>
      </main>
    </body>
  </html>
`

test('validates the official Dolcera no-openings surface and returns no jobs', async () => {
  const requests = []
  const scraper = createDolceraScraper()

  assert.equal(CAREER_PAGE_URL, 'https://web.dolcera.com/')
  assert.equal(validateNoOpeningsPage(officialNoOpeningsPage), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      return officialNoOpeningsPage
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('rejects a Dolcera page that does not retain the expected no-openings shape', async () => {
  const scraper = createDolceraScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<main><h1>Dolcera</h1></main>' }),
    /no longer exposes the expected no-openings page shape/,
  )
})
