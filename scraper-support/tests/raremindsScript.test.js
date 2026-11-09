import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  COMPANY_DOMAIN,
  createRaremindsScraper,
  hasNoPublicListingsSignal,
  hasOfficialSiteSignal,
} from '../../scraper/rareminds/script.js'

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rareminds</title>
    <script type="module" crossorigin src="/assets/index-iiXXK3js.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Dd4O1Q35.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('Rareminds scraper targets the reachable first-party homepage shell and recognizes the verified no-public-listings sentinel', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.rareminds.in/')
  assert.equal(COMPANY_DOMAIN, 'rareminds.in')
  assert.equal(hasOfficialSiteSignal(verifiedHomepageHtml), true)
  assert.equal(hasNoPublicListingsSignal(verifiedHomepageHtml), true)
})

test('run returns no jobs when Rareminds only exposes its official app shell without public jobs links', async () => {
  const requestedUrls = []
  const jobs = await createRaremindsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, CAREER_PAGE_URL)
      return verifiedHomepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the Rareminds public surface changes', async () => {
  await assert.rejects(
    createRaremindsScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified official public surface/i,
  )

  await assert.rejects(
    createRaremindsScraper().run({
      fetchText: async () => `
        <!doctype html>
        <html lang="en">
          <head>
            <title>Rareminds</title>
            <script type="module" crossorigin src="/assets/index-iiXXK3js.js"></script>
          </head>
          <body>
            <div id="root"></div>
            <a href="https://www.rareminds.in/vacancies/platform-engineer">Apply now</a>
            <p>Open roles in Bangalore</p>
          </body>
        </html>
      `,
    }),
    /no-public-listings surface/i,
  )
})
