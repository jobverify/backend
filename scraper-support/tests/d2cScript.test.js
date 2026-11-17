import assert from 'node:assert/strict'
import test from 'node:test'

const loadD2CModule = async () => {
  try {
    return await import('../../scraper/d2c/script.js')
  } catch {
    assert.fail('Expected D2C scraper module at ../../scraper/d2c/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mirav Labs — Production AI for Modern Enterprise</title>
    <meta
      name="description"
      content="Mirav Labs deploys production-grade AI for modern enterprises across voice, infrastructure and intelligent automation."
    >
  </head>
  <body>
    <main>
      <h1>Mirav Labs</h1>
      <section>
        <a href="/products/aegis">Mirav Aegis</a>
        <a href="/products/network-ai">Network AI</a>
        <a href="/products/voice-ai">Voice AI</a>
      </section>
      <footer>
        <a href="mailto:deepak@d2c.in">deepak@d2c.in</a>
        <span>+91-9650210909</span>
        <a href="/book-demo">Book a Demo Call</a>
      </footer>
    </main>
  </body>
</html>
`

const missingCareersRouteHtml = `
<!doctype html>
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
    <hr>
    <address>Apache/2.4.58 (Ubuntu) Server at d2c.in Port 443</address>
  </body>
</html>
`

test('D2C sentinel targets the verified first-party homepage shell and missing careers routes', async () => {
  const d2c = await loadD2CModule()

  assert.equal(d2c.SOURCE, 'd2c')
  assert.equal(d2c.COMPANY, 'D2C')
  assert.equal(d2c.HOMEPAGE_URL, 'https://d2c.in/')
  assert.deepEqual(d2c.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://d2c.in/careers',
    'https://d2c.in/careers/',
    'https://d2c.in/career',
    'https://d2c.in/jobs',
    'https://d2c.in/jobs/',
    'https://d2c.in/join-us',
    'https://d2c.in/work-with-us',
    'https://d2c.in/openings',
  ])
  assert.equal(d2c.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(d2c.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(d2c.hasCareerRouteLinkSignal(officialHomepageHtml), false)
  assert.equal(d2c.isVerifiedMissingCareerRoute({
    status: 404,
    url: 'https://d2c.in/careers',
    html: missingCareersRouteHtml,
  }), true)
})

test('D2C historical body-only and missing-route fixtures cannot establish current inventory', async () => {
 const source=await loadD2CModule();let calls=0
 await assert.rejects(source.createD2CScraper().run({fetchPage:async()=>{calls++;return {status:200,html:officialHomepageHtml}}}),/unsupported metadata-free/)
 assert.equal(calls,0)
})
test('D2C opaque pre-aborted caller owns cancellation before reading the publisher', async () => {
 const source=await loadD2CModule(),owner=new AbortController(),reason=Object.freeze({cancel:'d2c'});owner.abort(reason)
 await assert.rejects(source.run({signal:owner.signal,fetchImpl:async()=>assert.fail('unexpected fetch')}),value=>value===reason)
})
