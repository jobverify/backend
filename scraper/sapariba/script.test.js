import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createSapAribaScraper,
  hasExactSapAribaCareersSignal,
  hasGenericSapCareersSignal,
} from './script.js'

const GENERIC_SAP_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at SAP | SAP Careers</title>
  </head>
  <body>
    <main>
      <label>Search by keyword</label>
      <label>Search by location</label>
      <p>Top jobs</p>
    </main>
  </body>
</html>
`

const SAP_ARIBA_EXACT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at SAP | SAP Careers</title>
  </head>
  <body>
    <main>
      <label>Search by keyword</label>
      <label>Search by location</label>
      <h1>Careers at SAP Ariba</h1>
    </main>
  </body>
</html>
`

test('SAP Ariba recognizes the shared SAP careers shell and exact-name drift separately', () => {
  assert.equal(hasGenericSapCareersSignal(GENERIC_SAP_CAREERS_HTML), true)
  assert.equal(hasExactSapAribaCareersSignal(GENERIC_SAP_CAREERS_HTML), false)
  assert.equal(hasExactSapAribaCareersSignal(SAP_ARIBA_EXACT_HTML), true)
})

test('SAP Ariba accepts the trusted SAP jobs redirect when the generic careers shell remains intact', async () => {
  const scraper = createSapAribaScraper()

  const jobs = await scraper.run({
    fetchPage: async () => ({
      status: 200,
      url: 'https://jobs.sap.com/?locale=en_US',
      html: GENERIC_SAP_CAREERS_HTML,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('SAP Ariba still fails closed when SAP exposes an exact-name Ariba careers surface', async () => {
  const scraper = createSapAribaScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async () => ({
        status: 200,
        url: CAREERS_URL,
        html: SAP_ARIBA_EXACT_HTML,
      }),
    }),
    /exact-name SAP Ariba public jobs surface/i,
  )
})
