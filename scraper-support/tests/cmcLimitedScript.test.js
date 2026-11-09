import assert from 'node:assert/strict'
import test from 'node:test'

const historicalSurfaceHtml = `
<!doctype html>
<html>
  <head>
    <title>Information on CMC Business Solutions</title>
  </head>
  <body>
    <h1>CMC Limited is now Tata Consultancy Services</h1>
    <h2>The Former Home of CMC Limited</h2>
    <p>
      CMC Ltd. was amalgamated into Tata Consultancy Services on October 1, 2015.
      CMC is no longer a separate business entity.
    </p>
    <p>
      For information about CMC and their services please visit the TCS website at
      <a href="http://www.tcs.com/">www.tcs.com</a>.
    </p>
  </body>
</html>
`

const tcsCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>TCS Careers</title>
  </head>
  <body>
    <h1>Want to be a global change-maker? Join our team.</h1>
    <p>At TCS, we believe exceptional work begins with hiring, celebrating and nurturing the best people.</p>
    <nav>
      <a href="https://www.tcs.com/careers/india">India</a>
      <a href="https://www.tcs.com/careers">Join us</a>
    </nav>
  </body>
</html>
`

const tcsIndiaCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>TCS India Careers</title>
  </head>
  <body>
    <h1>Want to be a global change-maker? Join our team.</h1>
    <p>India</p>
    <p>TCS India</p>
    <a href="https://www.tcs.com/careers">Join us</a>
  </body>
</html>
`

const loadCmcLimitedModule = async () => {
  try {
    return await import('../../scraper/cmclimited/script.js')
  } catch {
    assert.fail('Expected CMC Limited scraper module at ../../scraper/cmclimited/script.js')
  }
}

test('CMC Limited sentinel recognizes the verified post-merger shell and parent TCS careers surfaces', async () => {
  const cmcLimited = await loadCmcLimitedModule()

  assert.equal(cmcLimited.SOURCE, 'cmclimited')
  assert.equal(cmcLimited.COMPANY, 'CMC Limited')
  assert.equal(cmcLimited.VERIFIED_AT, '2026-07-14')
  assert.equal(cmcLimited.CMC_INFO_URL, 'https://www.cmcltd.com/')
  assert.equal(cmcLimited.TCS_CAREERS_URL, 'https://www.tcs.com/careers')
  assert.equal(cmcLimited.TCS_INDIA_CAREERS_URL, 'https://www.tcs.com/careers/india')

  assert.equal(cmcLimited.hasHistoricalInfoSurfaceSignal(historicalSurfaceHtml), true)
  assert.equal(cmcLimited.hasHistoricalDomainJobSignal(historicalSurfaceHtml), false)
  assert.equal(cmcLimited.hasTcsCareersSignal(tcsCareersHtml), true)
  assert.equal(cmcLimited.hasTcsIndiaCareersSignal(tcsIndiaCareersHtml), true)
  assert.equal(cmcLimited.hasCmcSpecificJobsSignal(tcsIndiaCareersHtml), false)
  assert.equal(
    cmcLimited.hasHistoricalDomainJobSignal(
      `${historicalSurfaceHtml}<a href="https://jobs.cmcltd.com/openings/42">Apply</a>`,
    ),
    true,
  )
  assert.equal(
    cmcLimited.hasCmcSpecificJobsSignal('<html><body><h2>CMC Limited Jobs in India</h2></body></html>'),
    true,
  )
})

test('CMC Limited sentinel returns [] from the verified post-merger shell without probing blocked parent careers pages', async () => {
  const cmcLimited = await loadCmcLimitedModule()
  const requestedUrls = []

  const jobs = await cmcLimited.createCMCLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === cmcLimited.CMC_INFO_URL) {
        return { status: 200, url, headers: {}, html: historicalSurfaceHtml }
      }

      throw new Error(`Unexpected CMC Limited URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cmcLimited.CMC_INFO_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CMC Limited sentinel fails closed when the post-merger shell drifts or a CMC-specific public jobs surface appears', async () => {
  const cmcLimited = await loadCmcLimitedModule()

  await assert.rejects(
    cmcLimited.createCMCLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === cmcLimited.CMC_INFO_URL) {
          return { status: 200, url, headers: {}, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 200, url, headers: {}, html: tcsCareersHtml }
      },
    }),
    /post-merger cmc limited surface/i,
  )

  await assert.rejects(
    cmcLimited.createCMCLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === cmcLimited.CMC_INFO_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${historicalSurfaceHtml}<h2>CMC Limited Jobs in India</h2>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
