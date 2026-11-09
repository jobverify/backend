import assert from 'node:assert/strict'
import test from 'node:test'

const worldwideHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Worldwide</h1>
    <h2>Networked worldwide</h2>
    <h3>DT Digital Labs</h3>
    <p>DT Digital Labs in India is responsible for product development.</p>
    <a href="https://dtdl.in/">To website</a>
  </body>
</html>
`

const currentWorldwideHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Locations and shareholdings</h1>
    <section aria-label="Globally connected for international collaboration">
      <article class="teaser teaser--card">
        <h3 class="teaser__title">
          <a href="https://dtdl.in/" class="teaser__link">Digital Labs</a>
        </h3>
        <p class="teaser__text">DT Digital Labs create innovative digital products and services, ranging from entertainment and payment solutions to online shopping.</p>
        <a href="https://dtdl.in/" aria-label="Digital Labs">To website</a>
      </article>
    </section>
  </body>
</html>
`

const homepageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DTDL</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root">Loading ...</div>
  </body>
</html>
`

const modernHomepageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DTDL | Deutsche Telekom Digital Labs</title>
    <meta
      name="description"
      content="Deutsche Telekom Digital Labs | We build digital products that change how the world connects, pays, shops, and unwinds."
    >
    <link rel="canonical" href="https://dtdl.in/">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://dtdl.in/jobs/platform-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/deutschetelekomdigitallabs/script.js')
  } catch {
    assert.fail('Expected Deutsche Telekom Digital Labs scraper module at ../../scraper/deutschetelekomdigitallabs/script.js')
  }
}

test('Deutsche Telekom Digital Labs sentinel helpers stay pinned to the verified affiliate page and exact-name shell state', async () => {
  const dtdl = await loadModule()

  assert.equal(dtdl.SOURCE, 'deutschetelekomdigitallabs')
  assert.equal(dtdl.COMPANY, 'Deutsche Telekom Digital Labs')
  assert.equal(dtdl.HOMEPAGE_URL, 'https://dtdl.in/')
  assert.equal(dtdl.TELEKOM_WORLDWIDE_URL, 'https://www.telekom.com/en/company/worldwide')
  assert.equal(dtdl.VERIFIED_ON, '2026-08-01')
  assert.deepEqual(dtdl.CHECKED_ROUTE_URLS, [
    'https://dtdl.in/careers',
    'https://dtdl.in/jobs',
    'https://dtdl.in/join-us',
  ])
  assert.equal(dtdl.hasTelekomAffiliateSignal(worldwideHtml), true)
  assert.equal(dtdl.hasTelekomAffiliateSignal(currentWorldwideHtml), true)
  assert.equal(dtdl.hasExactNameHomepageShellSignal(homepageShellHtml), true)
  assert.equal(dtdl.hasExactNameHomepageShellSignal(modernHomepageShellHtml), true)
  assert.equal(dtdl.hasPublicJobSignals(homepageShellHtml), false)
  assert.equal(dtdl.hasPublicJobSignals(publicJobsHtml), true)
})

test('Deutsche Telekom Digital Labs sentinel returns [] only while the verified first-party shell exposes no trustworthy public jobs', async () => {
  const dtdl = await loadModule()
  const requestedUrls = []

  const jobs = await dtdl.createDeutscheTelekomDigitalLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === dtdl.TELEKOM_WORLDWIDE_URL) {
        return { status: 200, url, html: currentWorldwideHtml }
      }

      if (url === dtdl.HOMEPAGE_URL) {
        return { status: 200, url, html: modernHomepageShellHtml }
      }

      if (dtdl.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: modernHomepageShellHtml }
      }

      throw new Error(`Unexpected DTDL URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    dtdl.TELEKOM_WORLDWIDE_URL,
    dtdl.HOMEPAGE_URL,
    ...dtdl.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Deutsche Telekom Digital Labs sentinel fails closed when the affiliate page or shell drifts into a public jobs surface', async () => {
  const dtdl = await loadModule()

  await assert.rejects(
    dtdl.createDeutscheTelekomDigitalLabsScraper().run({
      fetchPage: async (url) => {
        if (url === dtdl.TELEKOM_WORLDWIDE_URL) {
          return { status: 200, url, html: '<html><body><h1>Worldwide</h1></body></html>' }
        }
        throw new Error(`Unexpected DTDL URL: ${url}`)
      },
    }),
    /verified telekom affiliate surface/i,
  )

  await assert.rejects(
    dtdl.createDeutscheTelekomDigitalLabsScraper().run({
      fetchPage: async (url) => {
        if (url === dtdl.TELEKOM_WORLDWIDE_URL) {
          return { status: 200, url, html: worldwideHtml }
        }

        if (url === dtdl.HOMEPAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected DTDL URL: ${url}`)
      },
    }),
    /exact-name homepage shell changed materially/i,
  )
})
