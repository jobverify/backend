import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_LANDING_URL,
  CORPORATE_CAREERS_URL,
  STORE_CAREERS_URL,
  createSapphireFoodsScraper,
  hasVerifiedNotFoundShell,
} from './script.js'

const NOT_FOUND_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found | Sapphire Foods</title>
  </head>
  <body>
    <nav>
      <a href="/careers">Careers</a>
      <a href="/careers/store-careers">Store Careers</a>
      <a href="/careers/corporate-careers">Corporate Careers</a>
    </nav>
    <main>
      <h1>Page not found</h1>
      <p>We're sorry, but the page you requested cannot be found.</p>
      <p>Sapphire Foods India Ltd.</p>
    </main>
  </body>
</html>
`

test('Sapphire Foods recognizes the branded first-party not-found shell', () => {
  assert.equal(hasVerifiedNotFoundShell(NOT_FOUND_HTML), true)
})

test('Sapphire Foods returns an empty set when landing, store, and corporate careers all resolve to the verified branded 404 shell', async () => {
  const scraper = createSapphireFoodsScraper()
  let loadRoleCardsCalled = false

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if ([CAREERS_LANDING_URL, STORE_CAREERS_URL, CORPORATE_CAREERS_URL].includes(url)) {
        return {
          status: 404,
          url,
          html: NOT_FOUND_HTML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    loadRoleCards: async () => {
      loadRoleCardsCalled = true
      return []
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(loadRoleCardsCalled, false)
})
