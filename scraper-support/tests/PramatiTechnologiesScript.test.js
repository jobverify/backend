import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Pramati &#8211; Build the next</title>
  </head>
  <body>
    <!--<li><a href="https://recruitcareers.zappyhire.com/pramati" target="_blank">Careers</a></li>-->
    <a href="https://recruitcareers.zappyhire.com/pramati" target="_blank"><div class="card first">Careers</div></a>
    <li><a href="/careers/">Careers</a></li>
    <p>Pramati builds independent, innovative technology companies focused on profitable, well-defined markets.</p>
    <p>Pramati Prism is where it all starts, our in-house accelerator which incubates products in early stage, and nurtures them before spinning them out into autonomous ventures.</p>
    <p>Catch the buzz. Pramati is a happening place for everyone &mdash; people, customers, and media.</p>
  </body>
</html>
`

const VERIFIED_CAREERS_404_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found &#8211; Pramati</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const VERIFIED_ZAPPYHIRE_HTML = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <title>Careers</title>
    <base href="/en/">
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pramatitechnologies/script.js')
  } catch {
    assert.fail('Expected Pramati Technologies scraper module at ../../scraper/pramatitechnologies/script.js')
  }
}

test('Pramati Technologies sentinel helpers stay pinned to the homepage link, missing careers route, and opaque zappyhire shell', async () => {
  const pramati = await loadModule()

  assert.equal(pramati.hasVerifiedHomepageSignal(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(pramati.hasLinkedZappyhireCareersBoard(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(
    pramati.isExpectedMissingCareersRoute({ status: 404, html: VERIFIED_CAREERS_404_HTML }),
    true,
  )
  assert.equal(pramati.isOpaqueZappyhireShell(VERIFIED_ZAPPYHIRE_HTML), true)
  assert.equal(
    pramati.pageExposesPublicJobs('<html><body><a href="/jobs/software-engineer">Software Engineer</a></body></html>'),
    true,
  )
})

test('Pramati Technologies default page fetch preserves the verified 404 careers route for sentinel inspection', async () => {
  const pramati = await loadModule()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    status: 404,
    url: pramati.CAREERS_URL,
    text: async () => VERIFIED_CAREERS_404_HTML,
  })

  try {
    const page = await pramati.defaultFetchPage(pramati.CAREERS_URL)

    assert.deepEqual(page, {
      status: 404,
      url: pramati.CAREERS_URL,
      html: VERIFIED_CAREERS_404_HTML,
    })
    assert.equal(pramati.isExpectedMissingCareersRoute(page), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Pramati Technologies run validates the homepage handoff contract before returning []', async () => {
  const pramati = await loadModule()
  const requestedUrls = []

  const jobs = await pramati.createPramatiTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pramati.HOMEPAGE_URL) return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
      if (url === pramati.CAREERS_URL) return { status: 404, url, html: VERIFIED_CAREERS_404_HTML }
      if (url === pramati.LINKED_CAREERS_BOARD_URL) return { status: 200, url, html: VERIFIED_ZAPPYHIRE_HTML }

      throw new Error(`Unexpected Pramati URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pramati.HOMEPAGE_URL,
    pramati.CAREERS_URL,
    pramati.LINKED_CAREERS_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Pramati Technologies fails closed when the linked careers board exposes public jobs directly', async () => {
  const pramati = await loadModule()

  await assert.rejects(
    pramati.createPramatiTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === pramati.HOMEPAGE_URL) return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        if (url === pramati.CAREERS_URL) return { status: 404, url, html: VERIFIED_CAREERS_404_HTML }
        return {
          status: 200,
          url,
          html: '<html><body><a href="/job/123">Senior Engineer</a></body></html>',
        }
      },
    }),
    /public jobs/i,
  )
})
