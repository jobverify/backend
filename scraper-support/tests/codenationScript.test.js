import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SITEMAP_URL,
  SOURCE,
  VERIFIED_ON,
  VERIFIED_SURFACE_SUMMARY,
  createCodenationScraper,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  hasVerifiedSitemapSignal,
  isVerifiedMissingCareersRoute,
} from '../../scraper/codenation/script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Code Nation - the award winning digital agency for progressive causes and organisations</title>
  </head>
  <body>
    <main>
      <h1>Technology for changemakers</h1>
      <p>Need expert support for your next campaign?</p>
      <a href="https://codenation.nationbuilder.com/forms/newsletter-signup">Newsletter</a>
      <a href="https://www.codenation.com/contact">Get expert advice</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.codenation.com/</loc>
  </url>
  <url>
    <loc>https://www.codenation.com/december_2022</loc>
  </url>
</urlset>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Code Nation - the award winning digital agency for progressive causes and organisations</title>
  </head>
  <body>
    <main>
      <img src="https://assets.nationbuilder.com/themes/6978353000b3553b7db51b47/attachments/original/1589263467/404.png?1589263467" alt="" />
      <h3>Need expert support for your next campaign?</h3>
      <a href="https://www.codenation.com/">Get expert advice</a>
    </main>
  </body>
</html>
`

test('Code Nation sentinel pins the verified first-party zero-public-careers surface from July 14, 2026', () => {
  assert.equal(SOURCE, 'codenation')
  assert.equal(COMPANY, 'Code Nation')
  assert.equal(VERIFIED_ON, '2026-07-14')
  assert.equal(HOMEPAGE_URL, 'https://www.codenation.com/')
  assert.equal(SITEMAP_URL, 'https://www.codenation.com/sitemap.xml')
  assert.deepEqual(CAREERS_URLS, [
    'https://www.codenation.com/careers',
    'https://www.codenation.com/jobs',
  ])
  assert.match(VERIFIED_SURFACE_SUMMARY, /nationbuilder/i)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><body>Other company</body></html>'), false)
  assert.equal(hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(
    hasVerifiedSitemapSignal(`${sitemapXml}<url><loc>https://www.codenation.com/jobs</loc></url>`),
    false,
  )
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    hasPublicJobsSignal('<a href="https://boards.greenhouse.io/codenation">Open positions</a>'),
    true,
  )
  assert.equal(isVerifiedMissingCareersRoute(404, careers404Html), true)
  assert.equal(isVerifiedMissingCareersRoute(200, careers404Html), false)
})

test('Code Nation sentinel returns [] only while the verified homepage, sitemap, and missing careers routes stay unchanged', async () => {
  const requestedUrls = []

  const jobs = await createCodenationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (CAREERS_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Code Nation URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    SITEMAP_URL,
    ...CAREERS_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Code Nation sentinel fails closed when the homepage, sitemap, or careers routes drift into a jobs surface', async () => {
  await assert.rejects(
    createCodenationScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected homepage</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createCodenationScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<url><loc>https://boards.greenhouse.io/codenation</loc></url>`,
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    createCodenationScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        return {
          status: 200,
          url,
          html: '<a href="https://jobs.lever.co/codenation">Apply now</a>',
        }
      },
    }),
    /public jobs surface|verified missing careers route/i,
  )
})
