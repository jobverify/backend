import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities - AvenuesAI</title>
  </head>
  <body>
    <main>
      <h1>Come Build The Future With Us</h1>
      <p>What it's like to work at Infibeam Avenues</p>
      <p>AvenuesAI Limited</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/infibeamavenues/script.js')
  } catch {
    assert.fail('Expected Infibeam Avenues scraper module at ../../scraper/infibeamavenues/script.js')
  }
}

test('Infibeam Avenues falls back to a browser-backed careers page loader when Node fetch times out', async () => {
  const infibeamAvenues = await loadModule()
  const requestedPrimaryUrls = []
  const requestedBrowserUrls = []

  const jobs = await infibeamAvenues.createInfibeamAvenuesScraper().run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      requestedBrowserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [infibeamAvenues.CAREERS_URL])
  assert.deepEqual(requestedBrowserUrls, [infibeamAvenues.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
