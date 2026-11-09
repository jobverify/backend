import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Tangent Automations scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tangent Automation &#8211; Tangentautomation</title>
  </head>
  <body>
    <header>
      <a href="https://www.tangentautomation.com/">Home</a>
      <a href="https://www.tangentautomation.com/about/">About Us</a>
      <a href="https://www.tangentautomation.com/links/">Links</a>
      <a href="https://www.tangentautomation.com/contact/">Contact Us</a>
    </header>
    <main>
      <h1>Tangent Automation</h1>
      <h2>Customisation</h2>
      <h2>Innovation</h2>
      <h2>Control System Design</h2>
      <h2>PLC Systems</h2>
      <section>
        <h3>What we do?</h3>
        <p>We provide unparalleled control systems, instrumentation and Industry standard compliance services.</p>
      </section>
      <section>
        <h3>Who we are?</h3>
        <p>We are a team of trained service engineers with years of hands on industry experience.</p>
      </section>
      <section>
        <h3>Our core values</h3>
        <p>Quality Comes First. Teamwork Spirit. Honesty and Integrity are our foundation.</p>
      </section>
      <section>
        <h3>Latest Project</h3>
      </section>
    </main>
    <footer>Copyright © 2014 Tangent Automation.</footer>
  </body>
</html>
`

const officialAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us &#8211; Tangent Automation</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Tangent Established in 2006 by a group of young entrepreneurs.</p>
      <p>Our primary function is to provide unparalleled control systems and instrumentation services to Power Management, Biotechnology, Pharmaceutical, Medical devices, Water / Waste Water and other process industries.</p>
      <h2>Our Vision</h2>
      <p>To be the preferred solution provider of our partners for control system engineering needs.</p>
    </main>
    <footer>Copyright © 2014 Tangent Automation.</footer>
  </body>
</html>
`

const officialContactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us &#8211; Tangent Automation</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>Tangent Automation</p>
      <p>#38, 1st Main, 3rd Cross, Malagala, New Outer Ring Road, Bangalore-560091.</p>
      <a href="mailto:sales@tangentautomation.com">sales@tangentautomation.com</a>
      <a href="mailto:info@tangentautomation.com">info@tangentautomation.com</a>
      <a href="tel:+918023188258">+91-80-23188258</a>
      <a href="tel:+919972396043">+919972396043</a>
      <label>Your Name (required)</label>
    </main>
    <footer>Copyright © 2014 Tangent Automation.</footer>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found &#8211; Tangent Automation</title>
  </head>
  <body class="error404">
    <section class="heading">
      <h1>404 - Page Not Found</h1>
    </section>
    <section id="page-404" class="content full">
      <div class="page-404">
        <h1>404</h1>
        <p>Apologies, but the page you requested could not be found. Perhaps searching will help.</p>
      </div>
    </section>
    <form action="https://www.tangentautomation.com/" method="get">
      <input type="text" name="s" placeholder="Search" />
    </form>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Tangent Automation</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/jobs/control-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Tangent Automations sentinel pins the verified official no-public-careers surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'tangentautomations')
  assert.equal(scraper.COMPANY, 'Tangent Automations')
  assert.equal(scraper.OFFICIAL_SITE_NAME, 'Tangent Automation')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.tangentautomation.com/')
  assert.equal(scraper.ABOUT_URL, 'https://www.tangentautomation.com/about/')
  assert.equal(scraper.CONTACT_URL, 'https://www.tangentautomation.com/contact/')
  assert.deepEqual(scraper.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.tangentautomation.com/career',
    'https://www.tangentautomation.com/career/',
    'https://www.tangentautomation.com/careers',
    'https://www.tangentautomation.com/careers/',
    'https://www.tangentautomation.com/jobs',
    'https://www.tangentautomation.com/jobs/',
    'https://www.tangentautomation.com/openings',
    'https://www.tangentautomation.com/current-openings',
  ])
  assert.equal(scraper.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(scraper.hasOfficialAboutSignal(officialAboutHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(officialContactHtml), true)
  assert.equal(scraper.hasFirstPartyCareerLikeLink(officialHomepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    scraper.isVerifiedMissingRoute({
      status: 404,
      url: scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Tangent Automations sentinel returns no jobs only while the verified first-party surface stays unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createTangentAutomationsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === scraper.ABOUT_URL) {
        return { status: 200, url, html: officialAboutHtml }
      }

      if (url === scraper.CONTACT_URL) {
        return { status: 200, url, html: officialContactHtml }
      }

      if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.ABOUT_URL,
    scraper.CONTACT_URL,
    ...scraper.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Tangent Automations sentinel fails closed when the verified no-public-careers surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createTangentAutomationsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>unexpected</body></html>' }
        }

        if (url === scraper.ABOUT_URL) {
          return { status: 200, url, html: officialAboutHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraper.createTangentAutomationsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${officialHomepageHtml}<a href="/careers">Careers</a>`,
          }
        }

        if (url === scraper.ABOUT_URL) {
          return { status: 200, url, html: officialAboutHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers surface/i,
  )

  await assert.rejects(
    scraper.createTangentAutomationsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === scraper.ABOUT_URL) {
          return { status: 200, url, html: officialAboutHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /contact page/i,
  )

  await assert.rejects(
    scraper.createTangentAutomationsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === scraper.ABOUT_URL) {
          return { status: 200, url, html: officialAboutHtml }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: officialContactHtml }
        }

        if (url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /no-public-careers route changed/i,
  )
})
