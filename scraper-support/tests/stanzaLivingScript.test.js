import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Stanza Living - Your Second Home in a new city.</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/partner-with-us">Partner With Us</a>
    </nav>
    <main>
      <h1>Your second home in a new city.</h1>
      <p>Experience the new era of shared living at our professionally managed spaces.</p>
      <h2>India's most trusted managed living provider</h2>
      <p>16+ Cities</p>
      <p>350+ Residences</p>
      <p>50,000+ Beds</p>
    </main>
  </body>
</html>
`

const ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>The journey of Stanza Living - Your Second Home</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>We didn't find it for us, so we created it for you</p>
      <p>It was 2015. Two erstwhile IIM-A hostel roomies, Anindya and Sandeep, met again.</p>
      <p>Today, we've come a long way - from the two residences in Delhi to an impressive 450+ residences in more than 24+ cities across the country.</p>
    </main>
  </body>
</html>
`

const CONTACT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Get in touch with Stanza Living - Your Second Home.</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>STANZA LIVING CORPORATE OFFICE</p>
      <p>14th Floor, Good Earth Trade Tower, Sector 62, Gurugram, 122098</p>
      <p>080 4762 2222</p>
      <p>New User</p>
      <p>Existing User</p>
      <p>Partnership</p>
    </main>
  </body>
</html>
`

const CAREERS_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>PG Near Careers Department, Mall Road, Dehradun with Free Food,Wifi & More | Boys/Girls PG Starting with 8k in Careers Department, Mall Road, Dehradun</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/partner-with-us">Partner With Us</a>
    </nav>
    <main>
      <p>Stanza Living Dehradun</p>
      <h1>PG near Careers Department, Mall Road, Dehradun</h1>
      <h2>6 PGs near Careers Department, Mall Road, Dehradun</h2>
      <p>Pattaya House PG in Pondha</p>
      <p>Koh Samui House PG in Pondha</p>
      <p>Schedule a Visit</p>
      <p>Request a callback</p>
      <h3>What our residents say</h3>
    </main>
  </body>
</html>
`

const JOBS_SURFACE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers at Stanza Living</h1>
    <h2>Current Openings</h2>
    <a href="https://jobs.ashbyhq.com/stanzaliving">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/stanzaliving/script.js')
  } catch {
    assert.fail('Expected Stanza Living scraper module at ../../scraper/stanzaliving/script.js')
  }
}

test('Stanza Living sentinel pins the verified homepage, about/contact pages, and misdirected careers route', async () => {
  const stanzaLiving = await loadModule()

  assert.equal(stanzaLiving.SOURCE, 'stanzaliving')
  assert.equal(stanzaLiving.COMPANY, 'Stanza Living')
  assert.equal(stanzaLiving.OFFICIAL_BRAND_NAME, 'Stanza Living')
  assert.equal(stanzaLiving.VERIFIED_ON, '2026-07-17')
  assert.equal(stanzaLiving.HOMEPAGE_URL, 'https://www.stanzaliving.com/')
  assert.equal(stanzaLiving.ABOUT_PAGE_URL, 'https://www.stanzaliving.com/about-us')
  assert.equal(stanzaLiving.CONTACT_PAGE_URL, 'https://www.stanzaliving.com/contact-us')
  assert.equal(stanzaLiving.CAREERS_URL, 'https://www.stanzaliving.com/careers')
  assert.equal(stanzaLiving.hasHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(stanzaLiving.hasAboutPageSignal(ABOUT_PAGE_HTML), true)
  assert.equal(stanzaLiving.hasContactPageSignal(CONTACT_PAGE_HTML), true)
  assert.equal(stanzaLiving.hasPublicJobsSignal(CAREERS_ROUTE_HTML), false)
  assert.equal(stanzaLiving.hasPublicJobsSignal(JOBS_SURFACE_HTML), true)
  assert.equal(
    stanzaLiving.isVerifiedMisdirectedCareersRoute({
      status: 200,
      url: 'https://www.stanzaliving.com/careers',
      html: CAREERS_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    stanzaLiving.isVerifiedMisdirectedCareersRoute({
      status: 200,
      url: 'https://www.stanzaliving.com/careers',
      html: CAREERS_ROUTE_HTML.replace('6 PGs near', '3 PGs near'),
    }),
    true,
  )
})

test('Stanza Living returns [] only while the verified first-party no-public-careers sentinel surface stays intact', async () => {
  const stanzaLiving = await loadModule()
  const requestedUrls = []

  const jobs = await stanzaLiving.createStanzaLivingScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === stanzaLiving.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === stanzaLiving.ABOUT_PAGE_URL) {
        return { status: 200, url, html: ABOUT_PAGE_HTML }
      }

      if (url === stanzaLiving.CONTACT_PAGE_URL) {
        return { status: 200, url, html: CONTACT_PAGE_HTML }
      }

      if (url === stanzaLiving.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_ROUTE_HTML }
      }

      throw new Error(`Unexpected Stanza Living URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    stanzaLiving.HOMEPAGE_URL,
    stanzaLiving.ABOUT_PAGE_URL,
    stanzaLiving.CONTACT_PAGE_URL,
    stanzaLiving.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Stanza Living fails closed when the verified no-public-careers contract drifts', async () => {
  const stanzaLiving = await loadModule()

  await assert.rejects(
    stanzaLiving.createStanzaLivingScraper().run({
      fetchPage: async (url) => {
        if (url === stanzaLiving.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        if (url === stanzaLiving.ABOUT_PAGE_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === stanzaLiving.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        return { status: 200, url, html: CAREERS_ROUTE_HTML }
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    stanzaLiving.createStanzaLivingScraper().run({
      fetchPage: async (url) => {
        if (url === stanzaLiving.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === stanzaLiving.ABOUT_PAGE_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === stanzaLiving.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        return { status: 200, url, html: JOBS_SURFACE_HTML }
      },
    }),
    /careers route now appears to expose public jobs/i,
  )

  await assert.rejects(
    stanzaLiving.createStanzaLivingScraper().run({
      fetchPage: async (url) => {
        if (url === stanzaLiving.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === stanzaLiving.ABOUT_PAGE_URL) {
          return { status: 200, url, html: ABOUT_PAGE_HTML }
        }

        if (url === stanzaLiving.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
      },
    }),
    /no-public-careers surface changed/i,
  )
})
