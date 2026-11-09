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
    <title>People Counting Solutions and Data Analytics Experts</title>
  </head>
  <body>
    <nav>
      <a href="https://xpandretail.com/about-us/">About Us</a>
      <a href="https://xpandretail.com/contact/">Contact</a>
    </nav>
    <main>
      <h1>Are You Growing Smarter with Data?</h1>
      <p>Xpandretail helps businesses transform footfall into strategy.</p>
      <p>With over 25 years of experience in the region, we offer unmatched expertise in business analytics.</p>
      <p>Get in Touch</p>
    </main>
    <footer>
      <p>© Copyright 2026 Xpandretail</p>
      <a href="https://xpandretail.com/privacy-policies/">Privacy Policies</a>
      <a href="https://xpandretail.com/terms-and-conditions/">Terms and Conditions</a>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About - Xpandretail Retail Data Analytics Experts</title>
  </head>
  <body>
    <main>
      <h1>Retail Data Analytics Experts</h1>
      <p>Xpandretail has been in Retail and Mall Data Analytics for over 2 decades.</p>
      <p>With over 500+ partnerships, Xpandretail has been delivering secure, cloud-based business intelligence platforms for over two decades globally.</p>
      <p>Get in Touch</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Xpandretail</title>
  </head>
  <body>
    <main>
      <h1>You See Customers. We Help You See Patterns.</h1>
      <p>Single Business Tower, Office 605, Business Bay, Dubai UAE</p>
      <p>info@sdsdxb.com</p>
      <p>102/103 Sam Tower, KP Vallon Rd, Indira Nagar, Kadavanthra, Ernakulam, Kerala 682020, India</p>
      <p>Get In Touch</p>
      <p>Connect with Data Analytics Expert</p>
    </main>
    <footer>
      <p>© Copyright 2026 Xpandretail</p>
    </footer>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy Policies - Xpandretail</title>
  </head>
  <body>
    <main>
      <p>This Privacy Policy sets out the basis on which Xpandretail powered by Sàvant Data System L.L.C collects, uses and discloses personal information.</p>
      <p>References in this Policy to Sàvant Data System L.L.C are references to different legal entities related by way of common corporate history.</p>
      <p>xpandretail.com</p>
    </main>
  </body>
</html>
`

const termsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Terms and Conditions - Xpandretail</title>
  </head>
  <body>
    <main>
      <p>By accessing Xpandretail powered by Sàvant Data System L.L.C, you agreed to use cookies in agreement with the Privacy Policy.</p>
      <p>Redistribute content from Xpandretail powered by Sàvant Data System L.L.C</p>
      <p>No use of Xpandretail powered by Sàvant Data System L.L.C’s logo or other artwork will be allowed for linking absent a trademark license agreement.</p>
    </main>
  </body>
</html>
`

const notFoundRoute = (url) => ({
  status: 404,
  url,
  location: null,
  html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
})

const publicJobsRoute = (url) => ({
  status: 200,
  url,
  location: null,
  html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
})

test('Xpandretail validates the verified homepage, about page, contact page, privacy page, and terms page', async () => {
  const xpandretail = await loadModule()
  assert.ok(xpandretail, 'Xpandretail scraper module should load')

  assert.equal(xpandretail.SOURCE, 'xpandretail')
  assert.equal(xpandretail.COMPANY, 'Xpandretail')
  assert.equal(xpandretail.HOMEPAGE_URL, 'https://xpandretail.com/')
  assert.equal(xpandretail.ABOUT_URL, 'https://xpandretail.com/about-us/')
  assert.equal(xpandretail.CONTACT_URL, 'https://xpandretail.com/contact/')
  assert.equal(xpandretail.PRIVACY_URL, 'https://xpandretail.com/privacy-policies/')
  assert.equal(xpandretail.TERMS_URL, 'https://xpandretail.com/terms-and-conditions/')
  assert.equal(xpandretail.CAREERS_ROUTE_URLS.length, 8)
  assert.equal(xpandretail.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(xpandretail.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(xpandretail.hasOfficialContactSignal(contactHtml), true)
  assert.equal(xpandretail.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(xpandretail.hasOfficialTermsSignal(termsHtml), true)
  assert.equal(xpandretail.hasPublicJobsSignal(publicJobsRoute('https://xpandretail.com/careers').html), true)
})

test('Xpandretail run returns an empty list only while the verified official surface exposes no public careers routes', async () => {
  const xpandretail = await loadModule()
  assert.ok(xpandretail, 'Xpandretail scraper module should load')

  const requestedUrls = []
  const jobs = await xpandretail.createXpandretailScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
      if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
      if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
      if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
      if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
      return notFoundRoute(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    xpandretail.HOMEPAGE_URL,
    xpandretail.ABOUT_URL,
    xpandretail.CONTACT_URL,
    xpandretail.PRIVACY_URL,
    xpandretail.TERMS_URL,
    ...xpandretail.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Xpandretail fails closed when the official site signals or public-careers contract change materially', async () => {
  const xpandretail = await loadModule()
  assert.ok(xpandretail, 'Xpandretail scraper module should load')

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: '<html><body><h1>Placeholder</h1></body></html>' }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
        return notFoundRoute(url)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: '<html><body><h1>About</h1></body></html>' }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
        return notFoundRoute(url)
      },
    }),
    /about/i,
  )

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: '<html><body><h1>Contact</h1></body></html>' }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
        return notFoundRoute(url)
      },
    }),
    /contact/i,
  )

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: '<html><body><h1>Privacy</h1></body></html>' }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
        return notFoundRoute(url)
      },
    }),
    /privacy/i,
  )

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: '<html><body><h1>Terms</h1></body></html>' }
        return notFoundRoute(url)
      },
    }),
    /terms/i,
  )

  await assert.rejects(
    xpandretail.createXpandretailScraper().run({
      fetchPage: async (url) => {
        if (url === xpandretail.HOMEPAGE_URL) return { status: 200, url, location: null, html: homepageHtml }
        if (url === xpandretail.ABOUT_URL) return { status: 200, url, location: null, html: aboutHtml }
        if (url === xpandretail.CONTACT_URL) return { status: 200, url, location: null, html: contactHtml }
        if (url === xpandretail.PRIVACY_URL) return { status: 200, url, location: null, html: privacyHtml }
        if (url === xpandretail.TERMS_URL) return { status: 200, url, location: null, html: termsHtml }
        if (url === xpandretail.CAREERS_ROUTE_URLS[0]) return publicJobsRoute(url)
        return notFoundRoute(url)
      },
    }),
    /careers routes/i,
  )
})
