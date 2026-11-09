import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createEsyposScraper,
  hasBrokenOfficialSurfaceSignal,
} from './script.js'

const framesetHtml = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
    </head>
    <frameset border="0" rows="100%,*" cols="100%" frameborder="no">
      <frame name="TopFrame" scrolling="yes" noresize>
    </frameset>
  </html>
`

test('broken surface signal accepts the current ESYPOS frameset shell', () => {
  assert.equal(hasBrokenOfficialSurfaceSignal(framesetHtml), true)
})

test('scraper returns no jobs when both ESYPOS routes are still broken framesets', async () => {
  const requestedUrls = []
  const scraper = createEsyposScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL || url === CAREERS_URL) {
        return framesetHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
})
