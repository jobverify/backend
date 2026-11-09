import assert from 'node:assert/strict'
import test from 'node:test'

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-rh="true">About Us | Read More - LazyPay</title>
  </head>
  <body>
    <h1>About Us</h1>
    <p>We are part of PayU, a leading financial services provider in global growth markets.</p>
    <h2>India’s Credit Super-app</h2>
    <p>Get Credit in 90 seconds. Shop at Millions of Merchants. Pay Later.</p>
    <p>LazyPay Private Limited is a part of PayU group, a leading financial services provider in global market.</p>
    <p>Lending done by our Lending Partner – PayU Finance India Private Limited</p>
    <p>wecare@lazypay.in</p>
    <footer>© 2026 Lazypay. All rights reserved</footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Jobs</h1>
    <a href="https://jobs.example.com/product-manager">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/lazypay/script.js')
  } catch {
    assert.fail('Expected LazyPay scraper module at ../../scraper/lazypay/script.js')
  }
}

test('LazyPay scraper exports the verified PayU-affiliated exact-name sentinel contract', async () => {
  const lazypay = await loadModule()

  assert.equal(lazypay.COMPANY, 'LazyPay')
  assert.equal(lazypay.OFFICIAL_BRAND_NAME, 'LazyPay Private Limited')
  assert.equal(lazypay.VERIFIED_ON, '2026-07-16')
  assert.equal(lazypay.HOMEPAGE_URL, 'https://www.lazypay.in/')
  assert.equal(lazypay.ABOUT_PAGE_URL, 'https://lazypay.in/about-us')
  assert.equal(lazypay.PARENT_CAREERS_URL, 'https://corporate.payu.in/careers/')
  assert.equal(lazypay.PARENT_JOB_BOARD_URL, 'https://careers.payu.in/PayU/go/_/514880/')
  assert.equal(lazypay.EXPECTED_404_URL, 'https://www.lazypay.in/404')
  assert.equal(lazypay.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(lazypay.pageExposesPublicJobListings(aboutPageHtml), false)
  assert.equal(lazypay.pageExposesPublicJobListings(publicJobsHtml), true)
})

test('LazyPay returns [] only while the verified about page stays non-listing and common careers routes stay 404', async () => {
  const lazypay = await loadModule()
  const requestedUrls = []

  const jobs = await lazypay.createLazyPayScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === lazypay.ABOUT_PAGE_URL) {
        return { status: 200, url, html: aboutPageHtml }
      }

      if (lazypay.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url: lazypay.EXPECTED_404_URL, html: '<html><body>404</body></html>' }
      }

      throw new Error(`Unexpected LazyPay URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lazypay.ABOUT_PAGE_URL,
    ...lazypay.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('LazyPay fails closed when the exact-name about page or common careers routes stop matching the verified sentinel surface', async () => {
  const lazypay = await loadModule()

  await assert.rejects(
    lazypay.createLazyPayScraper().run({
      fetchPage: async (url) => {
        if (url === lazypay.ABOUT_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (lazypay.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 404, url: lazypay.EXPECTED_404_URL, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected LazyPay URL: ${url}`)
      },
    }),
    /verified about page/i,
  )

  await assert.rejects(
    lazypay.createLazyPayScraper().run({
      fetchPage: async (url) => {
        if (url === lazypay.ABOUT_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (lazypay.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 404, url: lazypay.EXPECTED_404_URL, html: '<html><body>404</body></html>' }
        }

        throw new Error(`Unexpected LazyPay URL: ${url}`)
      },
    }),
    /first-party public jobs surface/i,
  )

  await assert.rejects(
    lazypay.createLazyPayScraper().run({
      fetchPage: async (url) => {
        if (url === lazypay.ABOUT_PAGE_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }

        if (lazypay.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected LazyPay URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
