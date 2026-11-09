import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_CANDIDATE_PATHS,
  COMPANY,
  HOMEPAGE_URL,
  PAGES_SITEMAP_URL,
  SOURCE,
  createPixcelsScraper,
  hasOfficialHomepageSignal,
  isVerifiedNoJobsSurface,
  pageExposesPublicJobListings,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Pi-xcels | E-Receipt Platform for Retail</title>
      <link rel="canonical" href="https://www.pi-xcels.com" />
      <meta name="description" content="Eco-friendly NFC digital receipts solution for actionable shopper data and enhanced customer journeys. No App, Just Tap." />
    </head>
    <body>
      <nav aria-label="Site">
        <a href="https://www.pi-xcels.com">Home</a>
        <a href="https://www.pi-xcels.com/about">About Us</a>
        <a href="https://www.pi-xcels.com/contact-us">Contact Us</a>
        <a href="https://www.pi-xcels.com/news">News</a>
      </nav>
      <main>
        <h1>Instant NFC powered digital receipts</h1>
        <p>Customer Intelligence Platform for Retailers.</p>
        <p>No App. Just Tap.</p>
        <a href="https://www.pi-xcels.com/contact-us">TAP FOR A DEMO</a>
      </main>
    </body>
  </html>
`

const pagesSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" generatedBy="WIX">
    <url><loc>https://www.pi-xcels.com</loc></url>
    <url><loc>https://www.pi-xcels.com/about</loc></url>
    <url><loc>https://www.pi-xcels.com/contact-us</loc></url>
    <url><loc>https://www.pi-xcels.com/news</loc></url>
    <url><loc>https://www.pi-xcels.com/kill-the-bill</loc></url>
    <url><loc>https://www.pi-xcels.com/privacy-policy</loc></url>
    <url><loc>https://www.pi-xcels.com/terms-of-service</loc></url>
    <url><loc>https://www.pi-xcels.com/cookie-policy</loc></url>
  </urlset>
`

const careers404Html = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Page Not Found</title>
    </head>
    <body>
      <h1>404 Error - Page Not Found</h1>
      <p>The page you requested could not be found.</p>
      <a href="https://www.pi-xcels.com">Back to Home</a>
    </body>
  </html>
`

test('verified Pi-xcels sentinel signals match the official no-jobs surface', () => {
  assert.equal(COMPANY, 'Pi-xcels')
  assert.equal(SOURCE, 'pixcels')
  assert.equal(HOMEPAGE_URL, 'https://www.pi-xcels.com/')
  assert.equal(PAGES_SITEMAP_URL, 'https://www.pi-xcels.com/pages-sitemap.xml')
  assert.deepEqual(CAREERS_CANDIDATE_PATHS, ['/careers', '/career', '/jobs', '/job-openings', '/join-us', '/work-with-us'])

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(pageExposesPublicJobListings(homepageHtml), false)
  assert.equal(
    isVerifiedNoJobsSurface({
      homepageHtml,
      sitemapXml: pagesSitemapXml,
      candidatePages: [
        { path: '/careers', status: 404, html: careers404Html },
        { path: '/jobs', status: 404, html: careers404Html },
      ],
    }),
    true,
  )
})

test('sentinel fails closed when public jobs appear or the verified surface drifts', () => {
  const jobsHomepageHtml = homepageHtml.replace(
    '</main>',
    '<section><h2>Open Positions</h2><a href="/careers/software-engineer">Software Engineer</a></section></main>',
  )

  assert.equal(pageExposesPublicJobListings(jobsHomepageHtml), true)
  assert.equal(
    isVerifiedNoJobsSurface({
      homepageHtml: jobsHomepageHtml,
      sitemapXml: pagesSitemapXml,
      candidatePages: [{ path: '/careers', status: 200, html: '<h1>Open Positions</h1>' }],
    }),
    false,
  )

  assert.equal(
    isVerifiedNoJobsSurface({
      homepageHtml: '<title>Pi-xcels</title>',
      sitemapXml: pagesSitemapXml,
      candidatePages: [{ path: '/careers', status: 404, html: careers404Html }],
    }),
    false,
  )
})

test('run returns [] only while the verified Pi-xcels no-jobs condition remains true', async () => {
  const seenUrls = []
  const scraper = createPixcelsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      seenUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { ok: true, status: 200, url, text: homepageHtml }
      }

      if (url === PAGES_SITEMAP_URL) {
        return { ok: true, status: 200, url, text: pagesSitemapXml }
      }

      if (url === 'https://www.pi-xcels.com/careers' || url === 'https://www.pi-xcels.com/jobs') {
        return { ok: false, status: 404, url, text: careers404Html }
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(seenUrls, [
    HOMEPAGE_URL,
    PAGES_SITEMAP_URL,
    'https://www.pi-xcels.com/careers',
    'https://www.pi-xcels.com/jobs',
  ])
  assert.deepEqual(jobs, [])
})

test('run throws when the Pi-xcels surface changes away from the verified sentinel state', async () => {
  const scraper = createPixcelsScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === PAGES_SITEMAP_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: `${pagesSitemapXml}<url><loc>https://www.pi-xcels.com/careers</loc></url>`,
          }
        }

        return { ok: false, status: 404, url, text: careers404Html }
      },
    }),
    /verified no-jobs public surface/,
  )
})
