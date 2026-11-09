import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Dealshare</title>
  </head>
  <body>
    <a href="https://about.dealshare.in/">About Us</a>
    <a href="https://about.dealshare.in/">Careers</a>
    <a href="https://www.dealshare.in/store-locator">Visit Our Store</a>
    <p>support@dealshare.in</p>
    <p>We Deliver To Rajasthan West Bengal Delhi & NCR Uttar Pradesh</p>
    <p>Something went wrong... please try again later</p>
  </body>
</html>
`

const directAccessDeniedHtml = `
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>
`

const aboutHubShellHtml = `
<!doctype html>
<html>
  <head>
    <title>DealShare</title>
    <script type="module" crossorigin src="/assets/index-4b034da8.js"></script>
    <link rel="stylesheet" href="/assets/index-5a00a0f0.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const spaBundleText = `
About Careers Media Contact
Mass Market for Mass India, Online
Watch Our Story
Crafting extraordinarily simple tech solutions to help Bharat shop with ease
Our Impact in numbers
Build. Innovate. Create Value.
Building everyday savings for India
Haq Se Bachao
Why DealShare
Our Culture
Flat Hierarchy
Growth & Innovation
PDA - Public Display of Appreciation
Financial Benefits
Fast Paced
Testimonials
Contact
support@dealshare.in
`

const publicJobsCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>DealShare Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/dealshare/software-engineer">Apply now</a>
  </body>
</html>
`

const publicJobsBundleText = `
${spaBundleText}
Current Openings
<a href="https://jobs.lever.co/dealshare/software-engineer">Apply now</a>
`

const loadDealShareModule = async () => {
  try {
    return await import('../../scraper/dealshare/script.js')
  } catch {
    assert.fail('Expected DealShare scraper module at ../../scraper/dealshare/script.js')
  }
}

test('DealShare sentinel constants stay pinned to the verified homepage, SPA careers route, and direct-route access denied state', async () => {
  const dealShare = await loadDealShareModule()

  assert.equal(dealShare.SOURCE, 'dealshare')
  assert.equal(dealShare.COMPANY, 'DealShare')
  assert.equal(dealShare.VERIFIED_ON, '2026-08-08')
  assert.equal(dealShare.HOMEPAGE_URL, 'https://www.dealshare.in/')
  assert.equal(dealShare.ABOUT_HUB_URL, 'https://about.dealshare.in/')
  assert.equal(dealShare.CAREERS_SPA_URL, 'https://about.dealshare.in/careers')
  assert.equal(dealShare.DIRECT_CAREERS_ROUTE_URL, 'https://about.dealshare.in/careers')
  assert.match(dealShare.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(dealShare.hasHomepageSignal(homepageHtml), true)
  assert.equal(
    dealShare.hasAccessDeniedDirectRouteSignal({
      status: 403,
      html: directAccessDeniedHtml,
    }),
    true,
  )
  assert.equal(dealShare.hasAboutHubShellSignal(aboutHubShellHtml), true)
  assert.equal(dealShare.hasAboutHubSignal(spaBundleText), true)
  assert.equal(dealShare.hasCareersSpaNoJobsSignal(spaBundleText), true)
  assert.equal(dealShare.hasCareersSpaNoJobsSignal(publicJobsCareersHtml), false)
  assert.deepEqual(dealShare.extractSuspiciousJobLinks(spaBundleText), [])
  assert.deepEqual(
    dealShare.extractSuspiciousJobLinks(publicJobsCareersHtml),
    ['https://jobs.lever.co/dealshare/software-engineer'],
  )
})

test('DealShare sentinel returns [] only while the verified SPA shell, published bundle, and direct route stay job-free', async () => {
  const dealShare = await loadDealShareModule()
  const requestedPages = []
  const bundleUrl = 'https://about.dealshare.in/assets/index-4b034da8.js'

  const jobs = await dealShare.createDealShareScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === dealShare.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === dealShare.DIRECT_CAREERS_ROUTE_URL) {
        return { status: 403, url, html: directAccessDeniedHtml }
      }

      if (url === dealShare.ABOUT_HUB_URL) {
        return { status: 200, url, html: aboutHubShellHtml }
      }

      if (url === bundleUrl) {
        return { status: 200, url, html: spaBundleText }
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    dealShare.HOMEPAGE_URL,
    dealShare.DIRECT_CAREERS_ROUTE_URL,
    dealShare.ABOUT_HUB_URL,
    bundleUrl,
  ])
  assert.deepEqual(jobs, [])
})

test('DealShare sentinel fails closed when the homepage, direct careers route, SPA shell, or published bundle drifts into a public jobs surface', async () => {
  const dealShare = await loadDealShareModule()
  const bundleUrl = 'https://about.dealshare.in/assets/index-4b034da8.js'

  await assert.rejects(
    dealShare.createDealShareScraper().run({
      fetchPage: async (url) => {
        if (url === dealShare.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }
        throw new Error('Should not fetch further')
      },
    }),
    /homepage no longer matches the verified public surface/i,
  )

  await assert.rejects(
    dealShare.createDealShareScraper().run({
      fetchPage: async (url) => {
        if (url === dealShare.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === dealShare.DIRECT_CAREERS_ROUTE_URL) {
          return { status: 200, url, html: spaBundleText }
        }
        throw new Error('Should not fetch further')
      },
    }),
    /direct careers route no longer matches the verified access-denied state/i,
  )

  await assert.rejects(
    dealShare.createDealShareScraper().run({
      fetchPage: async (url) => {
        if (url === dealShare.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === dealShare.DIRECT_CAREERS_ROUTE_URL) {
          return { status: 403, url, html: directAccessDeniedHtml }
        }
        if (url === dealShare.ABOUT_HUB_URL) {
          return { status: 200, url, html: aboutHubShellHtml }
        }
        if (url === bundleUrl) {
          return { status: 200, url, html: publicJobsBundleText }
        }
        throw new Error(`Unexpected fetch URL: ${url}`)
      },
    }),
    /careers page no longer matches the verified no-openings surface|public jobs links/i,
  )

  await assert.rejects(
    dealShare.createDealShareScraper().run({
      fetchPage: async (url) => {
        if (url === dealShare.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === dealShare.DIRECT_CAREERS_ROUTE_URL) {
          return { status: 403, url, html: directAccessDeniedHtml }
        }
        if (url === dealShare.ABOUT_HUB_URL) {
          return { status: 200, url, html: '<html><body><h1>Welcome</h1></body></html>' }
        }
        throw new Error(`Unexpected fetch URL: ${url}`)
      },
    }),
    /about hub no longer matches the verified public SPA shell/i,
  )
})
