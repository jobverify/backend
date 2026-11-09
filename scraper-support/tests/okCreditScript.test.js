import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Digital Bahi Khata & Ledger App | OkCredit</title>
  </head>
  <body>
    <main>
      <h1>Digital Udhar Bahi Khata</h1>
      <p>Keep track of receivables and payables. Make collections simpler and faster.</p>
      <footer>OkCredit Psi Phi Global Solutions Pvt. Ltd.</footer>
    </main>
  </body>
</html>
`

const LEGACY_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Check out top career opportunities with us | OkCredit</title>
  </head>
  <body>
    <main>
      <h1>Ready to create something big?</h1>
      <p>We are not hiring at the moment.</p>
      <p>No Current Job Openings</p>
      <a href="mailto:peopleops@okcredit.in">peopleops@okcredit.in</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/okcredit/script.js')
  } catch {
    assert.fail('Expected OkCredit scraper module at ../../scraper/okcredit/script.js')
  }
}

test('OkCredit accepts the current official homepage shell even after the old city-count marketing copy disappeared', async () => {
  const okcredit = await loadModule()

  assert.equal(okcredit.SOURCE, 'okcredit')
  assert.equal(okcredit.COMPANY, 'OkCredit')
  assert.equal(okcredit.HOMEPAGE_URL, 'https://okcredit.in/')
  assert.equal(okcredit.CAREERS_URL, 'https://okcredit.in/careers')
  assert.equal(okcredit.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(okcredit.hasOfficialCareersSignal(LEGACY_CAREERS_HTML), true)
})

test('OkCredit returns [] when the careers route falls back to the verified homepage shell without exposing public jobs', async () => {
  const okcredit = await loadModule()
  const requestedUrls = []

  const jobs = await okcredit.createOkCreditScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === okcredit.HOMEPAGE_URL || url === okcredit.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: HOMEPAGE_HTML,
        }
      }

      throw new Error(`Unexpected OkCredit URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    okcredit.HOMEPAGE_URL,
    okcredit.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OkCredit still fails closed when the careers route exposes a public jobs surface', async () => {
  const okcredit = await loadModule()

  await assert.rejects(
    okcredit.createOkCreditScraper().run({
      fetchPage: async (url) => {
        if (url === okcredit.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML,
          }
        }

        return {
          status: 200,
          url: okcredit.CAREERS_URL,
          html: '<html><body><a href="https://jobs.lever.co/okcredit">Open roles</a></body></html>',
        }
      },
    }),
    /public jobs/i,
  )
})
