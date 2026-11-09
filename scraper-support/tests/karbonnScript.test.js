import assert from 'node:assert/strict'
import test from 'node:test'

const loadKarbonnModule = async () => {
  try {
    return await import('../../scraper/karbonn/script.js')
  } catch {
    assert.fail('Expected Karbonn scraper module at ../../scraper/karbonn/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>karbonn</title>
  </head>
  <body>
    <nav>
      <a href="https://karbonn.in/?page_id=328">CONTACT US</a>
      <a href="https://karbonn.in/?page_id=944">CAREERS</a>
    </nav>
    <article class="elementor-location-popup">
      <form class="elementor-form" method="post" name="subscribe">SUBSCRIBE</form>
    </article>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>CAREERS &#8211; karbonn</title>
  </head>
  <body>
    <main>
      <h2><b>KARBONN</b> CAREER GROWTH</h2>
      <form class="elementor-form" method="post" name="subscribe">
        <input type="hidden" name="referer_title" value="CAREERS" />
        <input type="email" name="form_fields[email]" placeholder="ENTER YOUR EMAIL" />
      </form>
    </main>
  </body>
</html>
`

const staleRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>CAREERS - karbonn</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <article>
        <h3>Regional Sales Manager</h3>
        <p>Location: Delhi</p>
        <button>Apply Now</button>
      </article>
    </main>
  </body>
</html>
`

test('Karbonn pins the verified homepage careers link, subscribe-only careers page, and stale old route', async () => {
  const karbonn = await loadKarbonnModule()

  assert.equal(karbonn.SOURCE, 'karbonn')
  assert.equal(karbonn.COMPANY, 'Karbonn')
  assert.equal(karbonn.VERIFIED_ON, '2026-07-16')
  assert.equal(karbonn.HOMEPAGE_URL, 'https://www.karbonnmobiles.com/')
  assert.equal(karbonn.CAREERS_PAGE_URL, 'https://karbonn.in/?page_id=944')
  assert.equal(karbonn.STALE_CAREERS_ROUTE_URL, 'https://www.karbonnmobiles.com/careers.html?view=apply')

  assert.equal(karbonn.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(karbonn.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(karbonn.hasRenderablePublicJobsSignal(homepageHtml), false)
  assert.equal(karbonn.hasRenderablePublicJobsSignal(careersPageHtml), false)
  assert.equal(karbonn.hasRenderablePublicJobsSignal(liveJobsHtml), true)
  assert.equal(
    karbonn.isVerifiedMissingCareerRoute({
      status: 404,
      url: karbonn.STALE_CAREERS_ROUTE_URL,
      html: staleRouteHtml,
    }),
    true,
  )
  assert.equal(
    karbonn.isVerifiedMissingCareerRoute({
      status: 404,
      url: karbonn.STALE_CAREERS_ROUTE_URL,
      html: '',
    }),
    true,
  )
})

test('Karbonn sentinel returns [] only while the verified subscribe-only careers surface and stale route remain unchanged', async () => {
  const karbonn = await loadKarbonnModule()
  const requestedUrls = []

  const jobs = await karbonn.createKarbonnScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === karbonn.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === karbonn.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === karbonn.STALE_CAREERS_ROUTE_URL) {
        return { status: 404, url, html: staleRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    karbonn.HOMEPAGE_URL,
    karbonn.CAREERS_PAGE_URL,
    karbonn.STALE_CAREERS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Karbonn sentinel fails closed when the verified careers shell drifts or starts exposing live public jobs', async () => {
  const karbonn = await loadKarbonnModule()

  await assert.rejects(
    karbonn.createKarbonnScraper().run({
      fetchPage: async (url) => {
        if (url === karbonn.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>No careers link</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    karbonn.createKarbonnScraper().run({
      fetchPage: async (url) => {
        if (url === karbonn.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === karbonn.CAREERS_PAGE_URL) {
          return { status: 200, url, html: liveJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now exposes a live public jobs surface/i,
  )

  await assert.rejects(
    karbonn.createKarbonnScraper().run({
      fetchPage: async (url) => {
        if (url === karbonn.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === karbonn.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === karbonn.STALE_CAREERS_ROUTE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /stale first-party careers route changed materially/i,
  )
})
