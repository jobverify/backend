import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Onida – Leading Home Appliance Brand in India | India ka Onida</title>
  </head>
  <body>
    <nav>
      <a href="https://onida.com/life-at-onida">Life@Onida</a>
      <a href="javascript:;">Current Openings</a>
    </nav>
  </body>
</html>
`

const lifeAtOnidaHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at Onida | Culture, Careers &amp; Employee Experiences</title>
    <meta
      name="description"
      content="Explore life at Onida, our vibrant work culture, growth opportunities, and employee stories that define our camaraderie and innovation."
    >
    <link rel="canonical" href="https://onida.com/life-at-onida/">
  </head>
  <body>
    <h1>Life at Onida</h1>
    <p>Explore life at Onida, our vibrant work culture, growth opportunities, and employee stories.</p>
    <nav>
      <a href="https://onida.com/life-at-onida">Life@Onida</a>
      <a href="javascript:;">Current Openings</a>
    </nav>
  </body>
</html>
`

const blockedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Onida | 404 Page Not Found</title>
    <meta property="og:title" content="Page not found | Onida">
  </head>
  <body>
    <h1>404</h1>
    <p>Page not found</p>
  </body>
</html>
`

const accessibleCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article>
      <h2>Area Sales Manager</h2>
      <a href="/jobs/area-sales-manager">Apply Now</a>
    </article>
  </body>
</html>
`

const loadOnidaModule = async () => {
  try {
    return await import('../../scraper/onida/script.js')
  } catch {
    assert.fail('Expected Onida scraper module at ../../scraper/onida/script.js')
  }
}

test('Onida sentinel pins the verified homepage, Life@Onida page, and missing openings routes', async () => {
  const onida = await loadOnidaModule()

  assert.equal(onida.SOURCE, 'onida')
  assert.equal(onida.COMPANY, 'Onida')
  assert.equal(onida.VERIFIED_AT, '2026-07-17')
  assert.equal(onida.HOMEPAGE_URL, 'https://onida.com/')
  assert.equal(onida.LIFE_AT_ONIDA_URL, 'https://onida.com/life-at-onida/')
  assert.deepEqual(onida.BLOCKED_CAREERS_ROUTE_URLS, [
    'https://onida.com/current-openings/',
    'https://onida.com/careers/',
  ])

  assert.equal(onida.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(onida.hasOfficialLifeAtOnidaSignal(lifeAtOnidaHtml), true)
  assert.equal(onida.extractCurrentOpeningsHref(lifeAtOnidaHtml), 'javascript:;')
  assert.equal(onida.hasPublicJobBoardSignal(lifeAtOnidaHtml), false)
  assert.equal(onida.hasPublicJobBoardSignal(accessibleCareersHtml), true)
  assert.equal(
    onida.isVerifiedMissingCareersRoute({
      status: 404,
      url: 'https://onida.com/current-openings/',
      html: blockedCareersHtml,
    }),
    true,
  )
  assert.equal(
    onida.isVerifiedMissingCareersRoute({
      status: 200,
      url: 'https://onida.com/current-openings/',
      html: accessibleCareersHtml,
    }),
    false,
  )
})

test('Onida sentinel returns [] only while the verified first-party surface remains unchanged', async () => {
  const onida = await loadOnidaModule()
  const requestedUrls = []

  const jobs = await onida.createOnidaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === onida.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === onida.LIFE_AT_ONIDA_URL) {
        return { status: 200, url, html: lifeAtOnidaHtml }
      }

      if (onida.BLOCKED_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: blockedCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    onida.HOMEPAGE_URL,
    onida.LIFE_AT_ONIDA_URL,
    ...onida.BLOCKED_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Onida sentinel fails closed when the verified careers pages drift or the blocked routes become accessible', async () => {
  const onida = await loadOnidaModule()

  await assert.rejects(
    onida.createOnidaScraper().run({
      fetchPage: async (url) => {
        if (url === onida.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    onida.createOnidaScraper().run({
      fetchPage: async (url) => {
        if (url === onida.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === onida.LIFE_AT_ONIDA_URL) {
          return {
            status: 200,
            url,
            html: lifeAtOnidaHtml.replace('javascript:;', 'https://onida.com/current-openings/'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /life@onida page no longer matches the verified placeholder openings surface/i,
  )

  await assert.rejects(
    onida.createOnidaScraper().run({
      fetchPage: async (url) => {
        if (url === onida.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === onida.LIFE_AT_ONIDA_URL) {
          return { status: 200, url, html: lifeAtOnidaHtml }
        }

        return { status: 200, url, html: accessibleCareersHtml }
      },
    }),
    /careers route changed materially or now exposes a public jobs surface/i,
  )
})
