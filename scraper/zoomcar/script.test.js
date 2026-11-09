import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  JOBS_URL,
  NON_WWW_CAREERS_URL,
  createZoomcarScraper,
  hasOfficialMarketingShellSignal,
} from './script.js'

const marketingShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title id="meta-title">Zoomcar Self Drive Car Rentals in India | Book Online</title>
    <meta id="meta-desc" name="description" content="Enjoy affordable self-drive car hire with flexible plans and online booking. Hire a car for a day or choose monthly car rentals at Zoomcar." />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="https://www.zoomcar.com" />
    <link rel="canonical" href="https://www.zoomcar.com/" />
    <script type="application/ld+json">{"@type":"Product"}</script>
  </head>
  <body>
    <main>
      <h1>Book self drive car</h1>
      <p>Zoomcar consumer booking shell.</p>
    </main>
  </body>
</html>
`

test('Zoomcar accepts the current canonical attribute order on the consumer marketing shell', () => {
  assert.equal(hasOfficialMarketingShellSignal(marketingShellHtml), true)
})

test('Zoomcar consumer shell returns an empty discovery snapshot after every verified route matches', async () => {
  const requestedUrls = []

  const jobs = await createZoomcarScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url: url === NON_WWW_CAREERS_URL ? CAREERS_URL : url,
        html: marketingShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    NON_WWW_CAREERS_URL,
    JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})
