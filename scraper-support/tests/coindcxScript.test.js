import assert from 'node:assert/strict'
import test from 'node:test'

const loadCoinDCXModule = async () => {
  try {
    return await import('../../scraper/coindcx/script.js')
  } catch {
    assert.fail('Expected CoinDCX scraper module at ../../scraper/coindcx/script.js')
  }
}

const opportunitiesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CoinDCX Careers | Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Find your Job Opportunity</h1>
      <p>Change Starts Together!</p>
      <p>Didn't find the position you are looking for?</p>
      <p>Drop in your CV at apply@coindcx.com</p>
    </main>
  </body>
</html>
`

const cloudflareBlockedPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <p>Please enable cookies.</p>
    <h1>Sorry, you have been blocked</h1>
    <p>You are unable to access coindcx.com</p>
    <p>Cloudflare Ray ID: 1d8fd4e1f6373b21</p>
  </body>
</html>
`

test('CoinDCX stays pinned to the verified opportunities shell and no-public-listings state', async () => {
  const coindcx = await loadCoinDCXModule()

  assert.equal(coindcx.CAREER_PAGE_URL, 'https://careers.coindcx.com/opportunities')
  assert.equal(coindcx.hasOpportunityShellSignal(opportunitiesHtml), true)
  assert.equal(coindcx.hasNoPublicListingsSignal(opportunitiesHtml), true)
})

test('CoinDCX legacy opportunities shell is insufficient employer inventory proof', async () => {
  const coindcx = await loadCoinDCXModule()
  await assert.rejects(coindcx.createCoinDCXScraper().run({fetchText:async()=>opportunitiesHtml}), /LinkedIn.*profile|LinkedIn.*canonical/)
})
test('CoinDCX HTTP403 cannot become a successful zero inventory', async () => {
  const coindcx = await loadCoinDCXModule()
  await assert.rejects(coindcx.createCoinDCXScraper().run({fetchPage:async url=>({status:403,url,html:cloudflareBlockedPageHtml})}), /HTTP 403/)
})
test('CoinDCX unverified employer page fails closed', async () => {
  const coindcx = await loadCoinDCXModule()
  await assert.rejects(coindcx.createCoinDCXScraper().run({fetchText:async()=>'<h1>Jobs</h1>'}), /LinkedIn/)
})
