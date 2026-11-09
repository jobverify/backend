import assert from 'node:assert/strict'
import test from 'node:test'

const loadAlphaTechnoSolutionsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Alpha Techno</title>
  </head>
  <body>
    <nav>
      <a href="https://alphatechno.in/about-us/">About Us</a>
      <a href="https://alphatechno.in/contact-us/">Contact Us</a>
      <a href="https://alphatechno.in/certificate-verification-2/">Certificate Verification</a>
    </nav>
    <main>
      <img src="https://alphatechno.in/wp-content/uploads/2024/09/png-logo-alpha-2-1-1.png" alt="Alpha Techno">
      <p>Alpha Techno Education Hub, Narang market, Guru Ravidas Nagar, Nawanshahr, Punjab 144514</p>
      <p>Alpha Techno Provide the best Education in Nawanshahr &amp; Jalandhar</p>
      <p>Grow your career today with the Alpha Techno</p>
      <p>30+ Professional Courses</p>
      <a href="tel:918291150406">Call us</a>
      <a href="https://alphatechno.in/contact-us/">Contact Us</a>
    </main>
  </body>
</html>
`

const pageSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://alphatechno.in/</loc>
  </url>
  <url>
    <loc>https://alphatechno.in/about-us/</loc>
  </url>
  <url>
    <loc>https://alphatechno.in/contact-us/</loc>
  </url>
  <url>
    <loc>https://alphatechno.in/certificate-verification-2/</loc>
  </url>
  <url>
    <loc>https://alphatechno.in/courses/</loc>
  </url>
</urlset>`

const contactUsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us &#8211; Alpha Techno</title>
    <link rel="canonical" href="https://alphatechno.in/contact-us/" />
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <h2>Keep In Touch With Alpha Techno</h2>
      <p>Alpha Techno Education Hub, Narang market, Guru Ravidas Nagar, Nawanshahr, Punjab 144514</p>
      <p>Alpha Techno, 1st floor Phase 3 Tower Enciave, Nakodar Road, Jalandhar.(144001)</p>
      <p>Call Us</p>
      <p>© 2024 Alpha Techno All Right Reserved.</p>
    </main>
  </body>
</html>
`

const missingCareersRoute = {
  status: 404,
  url: 'https://alphatechno.in/careers/',
  html: '',
}

const publicJobsRoute = {
  status: 200,
  url: 'https://alphatechno.in/careers/',
  html: `
    <html>
      <head><title>Careers - Alpha Techno</title></head>
      <body>
        <main>
          <h1>Current Openings</h1>
          <article>
            <h2>Python Trainer</h2>
            <a href="/careers/python-trainer">Apply now</a>
          </article>
        </main>
      </body>
    </html>
  `,
}

test('Alpha Techno Solutions sentinel pins the verified Alpha Techno first-party surface', async () => {
  const alpha = await loadAlphaTechnoSolutionsModule()
  assert.ok(alpha, 'Expected Alpha Techno Solutions scraper module at ./script.js')

  assert.equal(alpha.SOURCE, 'alphatechnosolutions')
  assert.equal(alpha.COMPANY, 'Alpha Techno Solutions')
  assert.equal(alpha.HOMEPAGE_URL, 'https://alphatechno.in/')
  assert.equal(alpha.PAGE_SITEMAP_URL, 'https://alphatechno.in/wp-sitemap-posts-page-1.xml')
  assert.equal(alpha.CONTACT_US_URL, 'https://alphatechno.in/contact-us/')
  assert.deepEqual(alpha.CAREERS_ROUTE_URLS, [
    'https://alphatechno.in/careers/',
  ])
  assert.equal(alpha.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(alpha.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(alpha.hasOfficialContactPageSignal(contactUsHtml), true)
  assert.equal(alpha.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(alpha.hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isVerifiedNoPublicJobsRoute accepts the verified missing careers route and rejects public job pages', async () => {
  const alpha = await loadAlphaTechnoSolutionsModule()
  assert.ok(alpha, 'Expected Alpha Techno Solutions scraper module at ./script.js')

  assert.equal(alpha.isVerifiedNoPublicJobsRoute(missingCareersRoute), true)
  assert.equal(alpha.isVerifiedNoPublicJobsRoute(publicJobsRoute), false)
})

test('run returns an empty list only while Alpha Techno keeps the verified no-public-jobs surface', async () => {
  const alpha = await loadAlphaTechnoSolutionsModule()
  assert.ok(alpha, 'Expected Alpha Techno Solutions scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await alpha.createAlphaTechnoSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === alpha.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === alpha.PAGE_SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: pageSitemapXml,
        }
      }

      if (url === alpha.CONTACT_US_URL) {
        return {
          status: 200,
          url,
          html: contactUsHtml,
        }
      }

      return missingCareersRoute
    },
  })

  assert.deepEqual(requestedUrls, [
    alpha.HOMEPAGE_URL,
    alpha.PAGE_SITEMAP_URL,
    alpha.CONTACT_US_URL,
    ...alpha.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Alpha Techno surface changes or exposes jobs', async () => {
  const alpha = await loadAlphaTechnoSolutionsModule()
  assert.ok(alpha, 'Expected Alpha Techno Solutions scraper module at ./script.js')

  await assert.rejects(
    alpha.createAlphaTechnoSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === alpha.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Alpha Techno</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    alpha.createAlphaTechnoSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === alpha.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === alpha.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${pageSitemapXml}<loc>https://alphatechno.in/careers/</loc>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap no longer matches/i,
  )

  await assert.rejects(
    alpha.createAlphaTechnoSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === alpha.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === alpha.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml,
          }
        }

        if (url === alpha.CONTACT_US_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Contact Us</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page no longer matches/i,
  )

  await assert.rejects(
    alpha.createAlphaTechnoSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === alpha.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === alpha.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml,
          }
        }

        if (url === alpha.CONTACT_US_URL) {
          return {
            status: 200,
            url,
            html: contactUsHtml,
          }
        }

        return publicJobsRoute
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
