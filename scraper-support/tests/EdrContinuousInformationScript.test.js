import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/edrcontinuousinformation/script.js')
  } catch {
    assert.fail('Expected EDR Continuous Information scraper module at ../../scraper/edrcontinuousinformation/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>EDR</title>
  </head>
  <body>
    <h1>Global Resources At Your Command</h1>
    <a href="/about">Why EDR</a>
    <a href="/contact">Contact Us</a>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>404 Not Found</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h1>Open Positions</h1>
    <article class="job-card">
      <a href="/jobs/software-engineer">Software Engineer</a>
    </article>
  </body>
</html>
`

test('EDR Continuous Information validates the verified exact-name homepage and common route heuristics', async () => {
  const edr = await loadModule()

  assert.equal(edr.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(edr.hasCareersOrJobsSurfaceSignal(notFoundHtml), false)
  assert.equal(edr.hasPublicJobSignal(publicJobsHtml), true)
})

test('EDR Continuous Information run returns [] only while the exact-name domain still lacks a public careers surface', async () => {
  const edr = await loadModule()
  const requestedUrls = []

  const jobs = await edr.createEdrContinuousInformationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === edr.HOMEPAGE_URL) return homepageHtml
      if (edr.COMMON_CAREERS_URLS.includes(url)) {
        throw new Error('404')
      }
      throw new Error(`Unexpected EDR URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    edr.HOMEPAGE_URL,
    ...edr.COMMON_CAREERS_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('EDR Continuous Information fails closed when the exact-name domain starts exposing a careers or jobs surface', async () => {
  const edr = await loadModule()

  await assert.rejects(
    edr.createEdrContinuousInformationScraper().run({
      fetchText: async (url) => {
        if (url === edr.HOMEPAGE_URL) return homepageHtml
        if (url === 'https://www.edrinfo.net/careers') return publicJobsHtml
        throw new Error('404')
      },
    }),
    /now appears to expose a careers or jobs surface/i,
  )

  await assert.rejects(
    edr.createEdrContinuousInformationScraper().run({
      fetchText: async (url) => {
        if (url === edr.HOMEPAGE_URL) return '<html><body><h1>Unexpected shell</h1></body></html>'
        throw new Error('404')
      },
    }),
    /verified official homepage no longer matches the trusted surface/i,
  )
})
