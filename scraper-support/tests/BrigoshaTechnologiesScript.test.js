import assert from 'node:assert/strict'
import test from 'node:test'

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Us | brigosha Technologies</title>
  </head>
  <body>
    <main></main>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div id="root">You need to enable JavaScript to run this app.</div>
    <p>Join us! Begin your journey with us today and stay updated.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/brigoshatechnologies/script.js')
  } catch {
    assert.fail('Expected Brigosha Technologies scraper module at ../../scraper/brigoshatechnologies/script.js')
  }
}

test('Brigosha Technologies validates the verified join-us page and opaque portal handoff state', async () => {
  const brigosha = await loadModule()

  assert.equal(brigosha.SOURCE, 'brigoshatechnologies')
  assert.equal(brigosha.COMPANY, 'Brigosha Technologies')
  assert.equal(brigosha.CAREERS_PAGE_URL, 'https://www.brigosha.com/join-us/')
  assert.equal(brigosha.OFFICIAL_CAREERS_HANDOFF_URL, 'https://login.brigosha.com/')
  assert.equal(brigosha.VERIFIED_ON, '2026-08-01')
  assert.equal(brigosha.hasOfficialCareersSignal(joinUsHtml), true)
  assert.equal(brigosha.extractOfficialPortalHandoffUrl(joinUsHtml), null)
  assert.equal(brigosha.matchesVerifiedOpaquePortalState({ status: 200, url: 'https://login.brigosha.com/', html: portalHtml }), true)
})

test('Brigosha Technologies run verifies the first-party handoff state before returning []', async () => {
  const brigosha = await loadModule()
  const requestedUrls = []

  const jobs = await brigosha.createBrigoshaTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === brigosha.CAREERS_PAGE_URL) {
        return { status: 200, url, html: joinUsHtml }
      }
      if (url === brigosha.OFFICIAL_CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: portalHtml }
      }
      throw new Error(`Unexpected Brigosha URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.brigosha.com/join-us/',
    'https://login.brigosha.com/',
  ])
  assert.deepEqual(jobs, [])
})

test('Brigosha Technologies fails closed when the portal handoff starts exposing public job listings', async () => {
  const brigosha = await loadModule()

  await assert.rejects(
    brigosha.createBrigoshaTechnologiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === brigosha.CAREERS_PAGE_URL
          ? joinUsHtml
          : `${portalHtml}<a href="/job-description/jobId%3D25/">Apply Now</a>`,
      }),
    }),
    /public jobs surface/i,
  )
})
