import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Transformation Consultancy &amp; implementation service in London, UK | Brysa</title>
    <meta
      name="description"
      content="Brysa is a UK-based Salesforce partner specializing in management services. We assist businesses in adapting to continuously changing technology and trends."
    />
  </head>
  <body>
    <header>
      <nav>
        <a href="https://brysa.ai/about-us?hsLang=en">About Us</a>
        <a href="https://brysa.ai/contact-us?hsLang=en">Contact</a>
      </nav>
    </header>
    <main>
      <p>
        We are a UK-based digital transformation consultant, turning complex Salesforce
        transformations into smooth digital journeys.
      </p>
      <p>
        Run by a diverse team of 30+ experts spanning cultures and disciplines. Trusted by 50+
        companies sharing our core values for smarter transformation.
      </p>
      <p>Our Teams, Values &amp; Mission</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Brysa | Salesforce, AI &amp; Digital Transformation Experts</title>
    <meta
      name="description"
      content="Learn about Brysa, a trusted Salesforce consulting and AI transformation partner helping businesses modernise operations through CRM, automation, data, and intelligent digital solutions."
    />
  </head>
  <body>
    <main>
      <h1>About Brysa</h1>
      <p>We live by these values</p>
      <p>We are a people-first Salesforce Consulting Company.</p>
      <p>Satish Thiagarajan</p>
      <a href="/contact-us?hsLang=en" class="join-our-team-card">Join our team</a>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Get in Touch with Brysa for Crm and Salesforce Support Today</title>
    <meta
      name="description"
      content="Get in touch with Brysa's Salesforce experts. We're here to answer your questions and help you find the right solution for your business needs."
    />
  </head>
  <body>
    <main>
      <h1>Get in touch</h1>
      <p>Contact Us</p>
      <p>London, United Kingdom</p>
      <p>GET IN TOUCH</p>
    </main>
  </body>
</html>
`

const contactHtmlWithMojibake = contactHtml.replace("Brysa's", 'Brysaâ€™s')

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://brysa.ai</loc></url>
  <url><loc>https://brysa.ai/about-us</loc></url>
  <url><loc>https://brysa.ai/contact-us</loc></url>
  <url><loc>https://brysa.ai/insights/agile-project-management</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://brysa.ai/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Error 404 | Page not found</title>
        <link rel="shortcut icon" href="https://brysa.co.uk/hubfs/brysa-fav.svg">
        <link rel="canonical" href="https://brysa.ai/404">
      </head>
      <body>
        <script>var pidFromCookie = getCookie('brysa_pid');</script>
      </body>
    </html>
  `,
}

const publicJobsRoutePage = {
  status: 200,
  url: 'https://brysa.ai/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Brysa Careers</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="https://jobs.lever.co/brysa/platform-engineer">Apply now</a>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Brysa scraper module at ./script.js')
  }
}

test('Brysa sentinel recognizes the verified first-party homepage, about page, contact page, sitemap, and missing careers routes', async () => {
  const brysa = await loadModule()

  assert.equal(brysa.SOURCE, 'brysa')
  assert.equal(brysa.COMPANY, 'Brysa')
  assert.equal(brysa.HOMEPAGE_URL, 'https://brysa.ai/')
  assert.equal(brysa.ABOUT_URL, 'https://brysa.ai/about-us')
  assert.equal(brysa.CONTACT_URL, 'https://brysa.ai/contact-us')
  assert.equal(brysa.SITEMAP_URL, 'https://brysa.ai/sitemap.xml')
  assert.deepEqual(brysa.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://brysa.ai/careers',
    'https://brysa.ai/careers/',
    'https://brysa.ai/career',
    'https://brysa.ai/career/',
    'https://brysa.ai/jobs',
    'https://brysa.ai/jobs/',
    'https://brysa.ai/join-us',
    'https://brysa.ai/join-us/',
    'https://brysa.ai/openings',
    'https://brysa.ai/openings/',
    'https://brysa.ai/work-with-us',
    'https://brysa.ai/work-with-us/',
  ])

  assert.equal(brysa.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(brysa.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(brysa.hasOfficialContactSignal(contactHtml), true)
  assert.equal(brysa.hasOfficialContactSignal(contactHtmlWithMojibake), true)
  assert.equal(brysa.hasExpectedJoinTeamContactHandoff(aboutHtml), true)
  assert.equal(brysa.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(brysa.hasUnexpectedCareerLikeLink(aboutHtml), false)
  assert.equal(brysa.hasUnexpectedCareerLikeLink(contactHtml), false)
  assert.equal(brysa.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(brysa.hasPublicJobsSignal(aboutHtml), false)
  assert.equal(brysa.hasPublicJobsSignal(contactHtml), false)
  assert.equal(brysa.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(brysa.isVerifiedMissingCareersRoute(missingCareerRoutePage), true)
})

test('Brysa sentinel returns no jobs only while the verified first-party surface exposes no public careers board', async () => {
  const brysa = await loadModule()
  const requestedUrls = []

  const jobs = await brysa.createBrysaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === brysa.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === brysa.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === brysa.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === brysa.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (brysa.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    brysa.HOMEPAGE_URL,
    brysa.ABOUT_URL,
    brysa.CONTACT_URL,
    brysa.SITEMAP_URL,
    ...brysa.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Brysa sentinel fails closed when the verified first-party no-public-careers surface drifts', async () => {
  const brysa = await loadModule()

  await assert.rejects(
    brysa.createBrysaScraper().run({
      fetchPage: async (url) => {
        if (url === brysa.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    brysa.createBrysaScraper().run({
      fetchPage: async (url) => {
        if (url === brysa.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === brysa.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutHtml.replace('/contact-us?hsLang=en', '/careers'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /join-our-team contact handoff|about page now exposes/i,
  )

  await assert.rejects(
    brysa.createBrysaScraper().run({
      fetchPage: async (url) => {
        if (url === brysa.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === brysa.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === brysa.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === brysa.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://brysa.ai/careers</loc></url></urlset>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    brysa.createBrysaScraper().run({
      fetchPage: async (url) => {
        if (url === brysa.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === brysa.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === brysa.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === brysa.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === brysa.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsRoutePage
        if (brysa.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party careers route changed|public careers surface/i,
  )
})
