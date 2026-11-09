import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>MSP Square</title>
    <meta
      name="description"
      content="The Next Generation MSP model, powered by AI, Automation, and Offshore Excellence. Achieve unmatched productivity, profitability, and scalability."
    />
  </head>
  <body>
    <main>
      <h1>MSP Square</h1>
      <nav>
        <a href="/About">About</a>
        <a href="/Contact">Contact</a>
        <a href="/ManagedHelpdesk">Managed Helpdesk</a>
        <a href="/ManagedSecuritySOC">Managed Security SOC</a>
        <a href="/resource-bank">Resource Bank</a>
      </nav>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/uandsquaresolutions/script.js')
  } catch {
    assert.fail('Expected U&D Square Solutions scraper module at ../../scraper/uandsquaresolutions/script.js')
  }
}

test('U&D Square Solutions helpers stay pinned to the verified MSP Square redirect target from Saturday, July 18, 2026', async () => {
  const uds = await loadModule()

  assert.equal(uds.SOURCE, 'uandsquaresolutions')
  assert.equal(uds.COMPANY, 'U&D Square Solutions')
  assert.equal(uds.HOMEPAGE_URL, 'http://www.udsquare.com/')
  assert.equal(uds.REDIRECT_TARGET_URL, 'https://mspsquare.com/')
  assert.equal(uds.VERIFIED_ON, '2026-07-18')
  assert.equal(uds.hasRedirectedHomepageSignal(redirectedHomepageHtml), true)
  assert.equal(uds.pageExposesPublicJobListings(redirectedHomepageHtml), false)
})

test('U&D Square Solutions returns [] while the first-party site only hands off to an MSP Square homepage', async () => {
  const uds = await loadModule()
  const requestedUrls = []

  const jobs = await uds.createUAndDSquareSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === uds.HOMEPAGE_URL) return redirectedHomepageHtml
      throw new Error(`Unexpected U&D Square Solutions URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [uds.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('U&D Square Solutions fails closed when public jobs appear or the verified handoff drifts', async () => {
  const uds = await loadModule()

  await assert.rejects(
    uds.createUAndDSquareSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unknown</h1></body></html>',
    }),
    /MSP Square/i,
  )

  await assert.rejects(
    uds.createUAndDSquareSolutionsScraper().run({
      fetchText: async () => `${redirectedHomepageHtml}<a href="/careers/system-administrator-l2">Careers</a>`,
    }),
    /public careers or job listings/i,
  )
})
