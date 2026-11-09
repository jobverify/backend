import assert from 'node:assert/strict'
import test from 'node:test'

const compromisedHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="https://run.ayninfotech.com/">LOGIN</a>
    <h1>Deposit Pulsa Indosat ! Main Situs Pake Slot Pulsa Indosat Dan Platform Deposit Tri IM3 Cuman 5000 Pasti WD Terus</h1>
    <p>Powered by team</p>
  </body>
</html>
`

const currentCompromisedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.bigskyworldview.org" />
    <title>Big Sky Worldview Forum | Billings, MT</title>
    <meta
      name="description"
      content="We seek to represent Christianity in the traditional, orthodox approach based upon the Bible as the inspired word of God, the supreme source of truth and the final authority for faith and life."
    />
  </head>
  <body>
    <h1>Big Sky Worldview Forum | Billings, MT</h1>
    <p>We seek to represent Christianity in the traditional, orthodox approach based upon the Bible.</p>
    <footer>Big Sky Worldview Forum</footer>
  </body>
</html>
`

const currentFirstParty404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <center><h1>404 Not Found</h1></center>
    <p>The resource requested could not be found on this server!</p>
    <hr>
    <center>Proudly powered by LiteSpeed Web Server</center>
    <p>Please be advised that LiteSpeed Technologies Inc. is not a web hosting company and, as such, has no control over content found on this site.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ayninfotech/script.js')
  } catch {
    assert.fail('Expected AYN InfoTech scraper module at ../../scraper/ayninfotech/script.js')
  }
}

test('AYN InfoTech sentinel stays pinned to the verified untrusted-domain signals', async () => {
  const aynInfotech = await loadModule()

  assert.equal(aynInfotech.SOURCE, 'ayninfotech')
  assert.equal(aynInfotech.COMPANY, 'AYN InfoTech')
  assert.equal(aynInfotech.VERIFIED_ON, '2026-08-07')
  assert.equal(aynInfotech.HOMEPAGE_URL, 'https://www.ayninfotech.com/')
  assert.equal(aynInfotech.hasCompromisedHomepageSignal(compromisedHomepageHtml), true)
})

test('AYN InfoTech sentinel recognizes the current Friday, August 7, 2026 bigskyworldview redirect variant', async () => {
  const aynInfotech = await loadModule()

  assert.equal(aynInfotech.hasCompromisedHomepageSignal(currentCompromisedHomepageHtml), true)
  assert.equal(
    aynInfotech.isVerifiedUntrustedRoute({
      status: 200,
      url: 'https://www.bigskyworldview.org/',
      html: currentCompromisedHomepageHtml,
    }),
    true,
  )
})

test('AYN InfoTech sentinel returns [] only while every checked first-party route remains untrusted', async () => {
  const aynInfotech = await loadModule()
  const requestedUrls = []

  const jobs = await aynInfotech.createAynInfotechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url: 'https://account.umbrellainabox.com/',
        html: compromisedHomepageHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    aynInfotech.HOMEPAGE_URL,
    ...aynInfotech.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('AYN InfoTech sentinel returns [] while the Thursday, August 20, 2026 first-party 404 shell remains unchanged across checked routes', async () => {
  const aynInfotech = await loadModule()
  const requestedUrls = []

  const jobs = await aynInfotech.createAynInfotechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 404,
        url,
        html: currentFirstParty404Html,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    aynInfotech.HOMEPAGE_URL,
    ...aynInfotech.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('AYN InfoTech sentinel fails closed when the first-party domain starts exposing a different surface', async () => {
  const aynInfotech = await loadModule()

  await assert.rejects(
    aynInfotech.createAynInfotechScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: `
          <html>
            <body>
              <h1>AYN InfoTech</h1>
              <a href="/careers">Careers</a>
            </body>
          </html>
        `,
      }),
    }),
    /verified untrusted domain state changed/i,
  )
})
