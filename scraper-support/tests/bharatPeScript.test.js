import assert from 'node:assert/strict'
import test from 'node:test'

const loadBharatPeModule = async () => {
  try {
    return await import('../../scraper/bharatpe/script.js')
  } catch {
    assert.fail('Expected BharatPe scraper module at ../../scraper/bharatpe/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>BharatPe for Business</title>
      <link rel="canonical" href="https://bharatpe.com/">
    </head>
    <body>
      <header>
        <a href="https://bharatpe.com/">BharatPe</a>
        <a href="/career">Careers</a>
      </header>
      <main>
        <h1>BharatPe</h1>
        <p>India's leading fintech company for merchants.</p>
      </main>
    </body>
  </html>
`

const redirectedHomepageRoute = {
  status: 200,
  url: 'https://bharatpe.com/',
  html: homepageHtml,
}

const notFoundRoute = {
  status: 404,
  url: 'https://bharatpe.com/careers',
  html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
}

const publicJobsRoute = {
  status: 200,
  url: 'https://bharatpe.com/career',
  html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
}

test('BharatPe sentinel stays pinned to the official homepage and common careers routes', async () => {
  const bharatPe = await loadBharatPeModule()

  assert.equal(bharatPe.SOURCE, 'bharatpe')
  assert.equal(bharatPe.COMPANY, 'BharatPe')
  assert.equal(bharatPe.HOMEPAGE_URL, 'https://bharatpe.com/')
  assert.equal(bharatPe.CAREERS_ROUTE_URLS.length, 8)
  assert.equal(bharatPe.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bharatPe.hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isVerifiedNoPublicJobsRoute accepts 404s and homepage redirects but rejects public job pages', async () => {
  const bharatPe = await loadBharatPeModule()

  assert.equal(bharatPe.isVerifiedNoPublicJobsRoute(notFoundRoute), true)
  assert.equal(bharatPe.isVerifiedNoPublicJobsRoute(redirectedHomepageRoute), true)
  assert.equal(bharatPe.isVerifiedNoPublicJobsRoute(publicJobsRoute), false)
})

test('run fails closed when no current native recruiting handoff is published', async () => {
  const bharatPe = await loadBharatPeModule()
  const requestedUrls = []

  await assert.rejects(bharatPe.createBharatPeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bharatPe.HOMEPAGE_URL) {
        return {
          status: 200,
          url: bharatPe.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      return {
        ...redirectedHomepageRoute,
        url,
      }
    },
  }), /handoff/i)

  assert.deepEqual(requestedUrls, [bharatPe.HOMEPAGE_URL, bharatPe.CAREERS_URL])
})
