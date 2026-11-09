import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Free Bahi Khata Aur Udhar Ledger App | OkCredit</title>
  </head>
  <body>
    <h1>Digital Udhar Bahi Khata</h1>
    <p>Simple · Paperless · Secure</p>
    <footer>OkCredit Psi Phi Global Solutions Pvt. Ltd.</footer>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected OkCredit scraper module at ./script.js')
  }
}

test('OkCredit accepts the current homepage and treats a homepage redirect on /careers/ as zero public jobs', async () => {
  const okcredit = await loadModule()

  assert.equal(okcredit.hasOfficialHomepageSignal(homepageHtml), true)

  const jobs = await okcredit.createOkCreditScraper().run({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: homepageHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})
