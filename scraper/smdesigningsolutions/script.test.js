import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>S M Designing Solutions</title>
  </head>
  <body>
    <main>
      <h1>S M Designing Solutions</h1>
      <p>Mysuru</p>
      <p>Mechanical Design and Drafting Services</p>
      <a href="mailto:info@smdsui.com">info@smdsui.com</a>
      <a href="/contact-us">Contact Us</a>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 | S M Designing Solutions</title>
  </head>
  <body>
    <main>
      <h1>Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/">Go back home</a>
    </main>
  </body>
</html>
`

test('S M Designing Solutions validates the verified homepage and branded missing careers routes', async () => {
  const smDesigningSolutions = await loadModule()
  assert.ok(smDesigningSolutions, 'S M Designing Solutions scraper module should load')

  assert.equal(smDesigningSolutions.SOURCE, 'smdesigningsolutions')
  assert.equal(smDesigningSolutions.COMPANY, 'S M Designing Solutions')
  assert.equal(smDesigningSolutions.HOMEPAGE_URL, 'https://www.smdesigningsolutions.com/')
  assert.deepEqual(smDesigningSolutions.CAREERS_ROUTE_URLS, [
    'https://www.smdesigningsolutions.com/careers',
    'https://www.smdesigningsolutions.com/careers/',
    'https://www.smdesigningsolutions.com/career',
    'https://www.smdesigningsolutions.com/career/',
    'https://www.smdesigningsolutions.com/jobs',
    'https://www.smdesigningsolutions.com/jobs/',
    'https://www.smdesigningsolutions.com/join-us',
    'https://www.smdesigningsolutions.com/join-us/',
  ])
  assert.equal(smDesigningSolutions.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(smDesigningSolutions.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    smDesigningSolutions.isVerifiedMissingCareersRoute({
      status: 404,
      url: smDesigningSolutions.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: notFoundHtml,
    }),
    true,
  )
  assert.equal(
    smDesigningSolutions.isVerifiedMissingCareersRoute({
      status: 200,
      url: smDesigningSolutions.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: '<html><body><h1>Careers</h1><a href="/jobs/design-engineer">Apply now</a></body></html>',
    }),
    false,
  )
})

test('S M Designing Solutions returns no jobs only while the verified homepage and missing careers routes remain unchanged', async () => {
  const smDesigningSolutions = await loadModule()
  assert.ok(smDesigningSolutions, 'S M Designing Solutions scraper module should load')

  const requestedUrls = []
  const jobs = await smDesigningSolutions.createSmDesigningSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === smDesigningSolutions.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: homepageHtml }
      }

      if (smDesigningSolutions.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, headers: {}, html: notFoundHtml }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    smDesigningSolutions.HOMEPAGE_URL,
    ...smDesigningSolutions.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('S M Designing Solutions fails closed when the homepage or missing careers route contract changes', async () => {
  const smDesigningSolutions = await loadModule()
  assert.ok(smDesigningSolutions, 'S M Designing Solutions scraper module should load')

  await assert.rejects(
    smDesigningSolutions.createSmDesigningSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smDesigningSolutions.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return { status: 404, url, headers: {}, html: notFoundHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    smDesigningSolutions.createSmDesigningSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smDesigningSolutions.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${homepageHtml}<a href="https://jobs.lever.co/smdesigningsolutions">Open positions</a>`,
          }
        }

        return { status: 404, url, headers: {}, html: notFoundHtml }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    smDesigningSolutions.createSmDesigningSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === smDesigningSolutions.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        if (url === smDesigningSolutions.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/design-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, headers: {}, html: notFoundHtml }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
