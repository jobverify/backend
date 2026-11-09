import assert from 'node:assert/strict'
import test from 'node:test'

const homepageRedirectHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Inventory Management Software &amp; Small Business ERP | Cin7</title>
    <meta name="description" content="Streamline your inventory management with Cin7's inventory management software.">
  </head>
  <body>
    <h1>Inventory Management Software &amp; Small Business ERP</h1>
    <p>Streamline your inventory management with Cin7's inventory management software.</p>
    <p>Cin7 Core robust out of the box features to streamline operations.</p>
    <a href="https://www.cin7.com/careers/">Careers</a>
  </body>
</html>
`

const genericCin7CareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Cin7 | Grow Without Limits at Cin7</title>
  </head>
  <body>
    <h1>Grow Without Limits at Cin7</h1>
    <p>Join our team and help product businesses thrive.</p>
    <a href="https://jobs.lever.co/cin7">View career opportunities</a>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head><title>404 Not Found</title></head>
  <body><h1>Not Found</h1></body>
</html>
`

const loadOrderhiveModule = async () => {
  try {
    return await import('../../scraper/orderhive/script.js')
  } catch {
    assert.fail('Expected Orderhive scraper module at ../../scraper/orderhive/script.js')
  }
}

test('Orderhive scraper constants stay pinned to the verified exact-name homepage redirect and generic Cin7 parent careers page', async () => {
  const orderhive = await loadOrderhiveModule()

  assert.equal(orderhive.SOURCE, 'orderhive')
  assert.equal(orderhive.COMPANY, 'Orderhive')
  assert.equal(orderhive.HOMEPAGE_URL, 'https://orderhive.com/')
  assert.equal(orderhive.CAREERS_ROUTE_URL, 'https://orderhive.com/careers')
  assert.equal(orderhive.PARENT_HOMEPAGE_URL, 'https://www.cin7.com/')
  assert.equal(orderhive.PARENT_CAREERS_URL, 'https://www.cin7.com/careers/')
  assert.equal(orderhive.hasGenericParentHomepageSignal(homepageRedirectHtml), true)
  assert.equal(orderhive.hasGenericParentCareersSignal(genericCin7CareersHtml), true)
  assert.equal(orderhive.isMissingCareerRoute({ status: 404, url: orderhive.CAREERS_ROUTE_URL }), true)
})

test('Orderhive returns no jobs only while the exact-name homepage redirects to generic Cin7 and the Orderhive careers route stays missing', async () => {
  const orderhive = await loadOrderhiveModule()
  const requestedUrls = []

  const jobs = await orderhive.createOrderhiveScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === orderhive.HOMEPAGE_URL) {
        return { status: 200, url: orderhive.PARENT_HOMEPAGE_URL, html: homepageRedirectHtml }
      }

      if (url === orderhive.PARENT_CAREERS_URL) {
        return { status: 200, url, html: genericCin7CareersHtml }
      }

      if (url === orderhive.CAREERS_ROUTE_URL) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    orderhive.HOMEPAGE_URL,
    orderhive.PARENT_CAREERS_URL,
    orderhive.CAREERS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Orderhive fails closed when the verified redirect, parent careers surface, or missing exact-name careers route drift', async () => {
  const orderhive = await loadOrderhiveModule()

  await assert.rejects(
    orderhive.createOrderhiveScraper().run({
      fetchPage: async (url) => {
        if (url === orderhive.HOMEPAGE_URL) {
          return { status: 200, url: orderhive.HOMEPAGE_URL, html: homepageRedirectHtml }
        }

        if (url === orderhive.PARENT_CAREERS_URL) {
          return { status: 200, url, html: genericCin7CareersHtml }
        }

        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified exact-name homepage redirect/i,
  )

  await assert.rejects(
    orderhive.createOrderhiveScraper().run({
      fetchPage: async (url) => {
        if (url === orderhive.HOMEPAGE_URL) {
          return { status: 200, url: orderhive.PARENT_HOMEPAGE_URL, html: homepageRedirectHtml }
        }

        if (url === orderhive.PARENT_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: genericCin7CareersHtml.replace(
              'Join our team and help product businesses thrive.',
              'Join Orderhive as we scale ecommerce operations.',
            ),
          }
        }

        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified generic parent careers surface/i,
  )

  await assert.rejects(
    orderhive.createOrderhiveScraper().run({
      fetchPage: async (url) => {
        if (url === orderhive.HOMEPAGE_URL) {
          return { status: 200, url: orderhive.PARENT_HOMEPAGE_URL, html: homepageRedirectHtml }
        }

        if (url === orderhive.PARENT_CAREERS_URL) {
          return { status: 200, url, html: genericCin7CareersHtml }
        }

        if (url === orderhive.CAREERS_ROUTE_URL) {
          return { status: 200, url, html: '<html><body>Open roles</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
