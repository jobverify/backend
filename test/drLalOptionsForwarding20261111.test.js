import assert from 'node:assert/strict'
import test from 'node:test'

import { run } from '../scraper/drlalpathlabs/script.js'

// Authored HTML for the exported API contract; this is not a native capture.
const applicationOnlyPage = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Submit Your CV to Dr Lal PathLabs</title>
      <link rel="canonical" href="https://www.lalpathlabs.com/career/submit-your-cv" />
    </head>
    <body>
      <h2>Find a Job &amp; Grow Your Career</h2>
      <form>
        <label>Attach your Updated Resume, Max size 2MB*</label>
        <button type="submit">Submit</button>
      </form>
    </body>
  </html>
`
const expectedUrl = 'https://www.lalpathlabs.com/career/submit-your-cv'

test('exported Dr Lal run uses the injected application-only page', async () => {
  const requestedUrls = []
  const jobs = await run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return applicationOnlyPage
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [expectedUrl])
})

test('exported Dr Lal run preserves the injected transport failure identity', async () => {
  const failure = new Error('Authored injected transport failure')
  const requestedUrls = []

  await assert.rejects(run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw failure
    },
  }), error => error === failure)
  assert.deepEqual(requestedUrls, [expectedUrl])
})

test('exported Dr Lal run fails closed for injected invalid markup', async () => {
  const requestedUrls = []

  await assert.rejects(run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return '<!doctype html><title>Unrelated application page</title>'
    },
  }), /Dr Lal PathLabs careers page no longer exposes the expected no-openings page shape/)
  assert.deepEqual(requestedUrls, [expectedUrl])
})
