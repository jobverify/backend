import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Celkon Group</title>
    <link rel="canonical" href="https://celkongroup.com/" />
  </head>
  <body>
    <a href="/about-us/">About Us</a>
    <a href="/contacts/">Contact</a>
    <p>Build Smarter. Deliver Faster.</p>
    <p>Trusted by Government Bodies, Enterprises & Institutions Across India</p>
    <p>Celkon Group transforms innovation into impact through world-class electronics manufacturing and purpose-driven technology.</p>
    <p>info@celkonmobiles.com</p>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Celkon Group</title>
  </head>
  <body>
    <h1>Why we are the best</h1>
    <p>Celkon began it's journey in 2009 with a bold vision to make mobile technology accessible and affordable to every household in India.</p>
    <p>Today, Celkon stands as the No.1 supplier of Mobile Phones, Tablets, and Interactive Flat Panel Displays for Government initiatives in India.</p>
  </body>
</html>
`

const currentAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us &#8211; Celkon Group</title>
  </head>
  <body>
    <h1>Why we are the best</h1>
    <p>At Celkon Group, we combine innovation, engineering excellence, and large-scale manufacturing to deliver world-class electronic solutions for India’s growing digital ecosystem.</p>
    <p>Today, Celkon stands as the No.1 supplier of Mobile Phones, Tablets, and Interactive Flat Panel Displays for Government initiatives in India.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contacts - Celkon Group</title>
  </head>
  <body>
    <h1>Contact Us Easily Online</h1>
    <p>info@celkonmobiles.com</p>
    <p>2/32, Kavuri Hills Rd, CBI Colony, Madhapur, Hyderabad, Telangana 500033</p>
    <p>+91 905 2345678</p>
  </body>
</html>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://celkongroup.com/</loc></url>
  <url><loc>https://celkongroup.com/contacts/</loc></url>
  <url><loc>https://celkongroup.com/about-us/</loc></url>
  <url><loc>https://celkongroup.com/gallery/</loc></url>
</urlset>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - Celkon Group</title>
  </head>
  <body>
    <a href="/about-us/">About Us</a>
    <a href="/contacts/">Contacts</a>
    <div>404</div>
    <p>We're sorry, but the page you were looking for doesn't exist</p>
  </body>
</html>
`

const loadCelkonModule = async () => {
  try {
    return await import('../../scraper/celkon/script.js')
  } catch {
    assert.fail('Expected Celkon scraper module at ../../scraper/celkon/script.js')
  }
}

test('Celkon sentinel pins the verified first-party no-public-careers surface from July 14, 2026', async () => {
  const celkon = await loadCelkonModule()
  const currentContactHtml = contactHtml.replace('Contacts - Celkon Group', 'Contacts &#8211; Celkon Group')

  assert.equal(celkon.SOURCE, 'celkon')
  assert.equal(celkon.COMPANY, 'Celkon')
  assert.equal(celkon.VERIFIED_ON, '2026-07-14')
  assert.equal(celkon.LEGACY_HOMEPAGE_URL, 'https://www.celkonmobiles.com/')
  assert.equal(celkon.HOMEPAGE_URL, 'https://celkongroup.com/')
  assert.equal(celkon.ABOUT_URL, 'https://celkongroup.com/about-us/')
  assert.equal(celkon.CONTACT_URL, 'https://celkongroup.com/contacts/')
  assert.equal(celkon.PAGE_SITEMAP_URL, 'https://celkongroup.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(celkon.CAREERS_ROUTE_URLS, [
    'https://celkongroup.com/careers/',
    'https://celkongroup.com/career/',
    'https://celkongroup.com/jobs/',
    'https://celkongroup.com/job/',
    'https://celkongroup.com/join-us/',
    'https://celkongroup.com/openings/',
  ])
  assert.match(celkon.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(
    celkon.isVerifiedLegacyHomepageRedirect({
      status: 200,
      url: celkon.HOMEPAGE_URL,
      html: homepageHtml,
    }),
    true,
  )
  assert.equal(celkon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(celkon.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(celkon.hasOfficialAboutSignal(currentAboutHtml), true)
  assert.equal(celkon.hasOfficialContactSignal(contactHtml), true)
  assert.equal(celkon.hasOfficialContactSignal(currentContactHtml), true)
  assert.equal(celkon.hasVerifiedPageSitemapSignal(pageSitemapXml), true)
  assert.equal(celkon.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(celkon.hasFirstPartyCareerLikeLink('<a href="/careers/">Careers</a>'), true)
  assert.equal(celkon.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    celkon.hasPublicJobsSignal('<a href="https://boards.greenhouse.io/celkon">Open positions</a>'),
    true,
  )
  assert.equal(
    celkon.isVerifiedMissingCareersRoute({
      status: 404,
      url: celkon.CAREERS_ROUTE_URLS[0],
      html: careers404Html,
    }),
    true,
  )
})

test('Celkon sentinel returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const celkon = await loadCelkonModule()
  const requestedUrls = []

  const jobs = await celkon.createCelkonScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === celkon.LEGACY_HOMEPAGE_URL) {
        return { status: 200, url: celkon.HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === celkon.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === celkon.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === celkon.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === celkon.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (celkon.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Celkon URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    celkon.LEGACY_HOMEPAGE_URL,
    celkon.HOMEPAGE_URL,
    celkon.ABOUT_URL,
    celkon.CONTACT_URL,
    celkon.PAGE_SITEMAP_URL,
    ...celkon.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Celkon sentinel fails closed when the verified first-party surface drifts into a public jobs surface', async () => {
  const celkon = await loadCelkonModule()

  await assert.rejects(
    celkon.createCelkonScraper().run({
      fetchPage: async (url) => {
        if (url === celkon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected Celkon URL: ${url}`)
      },
    }),
    /legacy celkon homepage no longer redirects to the verified first-party surface/i,
  )

  await assert.rejects(
    celkon.createCelkonScraper().run({
      fetchPage: async (url) => {
        if (url === celkon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: celkon.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === celkon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === celkon.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === celkon.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === celkon.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${pageSitemapXml}<url><loc>https://celkongroup.com/careers/</loc></url>`,
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /page sitemap now exposes a careers-like route/i,
  )

  await assert.rejects(
    celkon.createCelkonScraper().run({
      fetchPage: async (url) => {
        if (url === celkon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: celkon.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === celkon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === celkon.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === celkon.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === celkon.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === celkon.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/celkon">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
