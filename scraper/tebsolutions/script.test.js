import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  PAGE_SITEMAP_URL,
  SOURCE,
  createTebSolutionsScraper,
  hasOfficialHomepageSignal,
  hasOfficialPageSitemapSignal,
  hasPublicJobsSignal,
  isVerifiedNoPublicJobsRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>TEBSolutions- Your Path to Digital Excellence</title>
      <meta name="description" content="TEB Solutions digital services">
      <meta property="og:site_name" content="TEB Solutions">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"TEB Solutions"}]}
      </script>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="#about">About Us</a>
        <a href="#service">Services</a>
        <a href="/marketing/">Marketing</a>
        <a href="/web-design/">Web Design</a>
        <a href="/blog/">Blog</a>
        <a href="#contact">Contact us</a>
      </nav>
      <main>
        <p>Your Path to Digital Excellence</p>
        <p>We build high-converting websites and drive traffic through powerful digital marketing.</p>
        <p>Grow online with targeted strategies built for performance and lasting impact.</p>
        <p>TEB Solutions - Roorkee - Web Design</p>
        <p>Website Designing Company in Roorkee & Uttarakhand – Modern, Fast & Built to Convert</p>
        <a href="mailto:info@tebsolutions.in">info@tebsolutions.in</a>
      </main>
    </body>
  </html>
`

const pageSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tebsolutions.in/web-design/</loc>
  </url>
  <url>
    <loc>https://tebsolutions.in/marketing/</loc>
  </url>
  <url>
    <loc>https://tebsolutions.in/blog/</loc>
  </url>
  <url>
    <loc>https://tebsolutions.in/unsubscribe/</loc>
  </url>
</urlset>`

const soft404CareersHtml = `
  <html>
    <head>
      <title>Page Not Found - TEB Solutions</title>
    </head>
    <body>
      <a href="/">Home</a>
      <a href="/marketing/">Marketing</a>
      <a href="/web-design/">Web Design</a>
      <a href="/blog/">Blog</a>
      <a href="#contact">Contact us</a>
      <main>
        <h1>Article & News Category:</h1>
        <p>It seems we can&#039;t find what you're looking for.</p>
        <p>Seamless Communication, Global Impact.</p>
        <p>Transforming Ideas into Digital Excellence.</p>
        <p>Send us a message</p>
      </main>
    </body>
  </html>
`

const publicJobsRoute = {
  status: 200,
  url: 'https://tebsolutions.in/jobs/',
  html: `
    <html>
      <head><title>Careers - TEB Solutions</title></head>
      <body>
        <main>
          <h1>Current Openings</h1>
          <article>
            <h2>SEO Executive</h2>
            <p>Mumbai, India</p>
            <a href="/jobs/seo-executive">Apply now</a>
          </article>
        </main>
      </body>
    </html>
  `,
}

test('TEB Solutions sentinel pins the verified homepage, page sitemap, and common careers routes', () => {
  assert.equal(SOURCE, 'tebsolutions')
  assert.equal(COMPANY, 'TEB Solutions')
  assert.equal(HOMEPAGE_URL, 'https://tebsolutions.in/')
  assert.equal(PAGE_SITEMAP_URL, 'https://tebsolutions.in/page-sitemap.xml')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://tebsolutions.in/careers',
    'https://tebsolutions.in/careers/',
    'https://tebsolutions.in/career',
    'https://tebsolutions.in/career/',
    'https://tebsolutions.in/jobs',
    'https://tebsolutions.in/jobs/',
  ])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(hasPublicJobsSignal(soft404CareersHtml), false)
  assert.equal(hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isVerifiedNoPublicJobsRoute accepts the branded soft-404 careers routes and rejects public job pages', () => {
  assert.equal(isVerifiedNoPublicJobsRoute({
    status: 200,
    url: 'https://tebsolutions.in/careers/',
    html: soft404CareersHtml,
  }), true)
  assert.equal(isVerifiedNoPublicJobsRoute(publicJobsRoute), false)
})

test('run returns an empty list only while TEB Solutions keeps the verified no-public-careers surface', async () => {
  const requestedUrls = []
  const scraper = createTebSolutionsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url: HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === PAGE_SITEMAP_URL) {
        return {
          status: 200,
          url: PAGE_SITEMAP_URL,
          html: pageSitemapXml,
        }
      }

      return {
        status: 200,
        url: url.endsWith('/') ? url : `${url}/`,
        html: soft404CareersHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, PAGE_SITEMAP_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage, page sitemap, or careers routes drift into a public jobs surface', async () => {
  await assert.rejects(
    createTebSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: '<html><body><h1>TEB Solutions</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    createTebSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url: PAGE_SITEMAP_URL,
            html: `${pageSitemapXml}<loc>https://tebsolutions.in/careers/</loc>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap no longer matches/i,
  )

  await assert.rejects(
    createTebSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url: PAGE_SITEMAP_URL,
            html: pageSitemapXml,
          }
        }

        return publicJobsRoute
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})


const currentTebHome = homepageHtml.replace('TEBSolutions- Your Path to Digital Excellence</title>', 'HomePage - TEB Solutions</title>')
  .replace('<a href="mailto:info@tebsolutions.in">info@tebsolutions.in</a>', '<img src="/wp-content/uploads/2025/07/Tattavit-Blue-PNG.png" alt="TEB Solutions"><p>Seamless Communication, Global Impact.</p><p>Transforming Ideas into Digital Excellence.</p><p>Send us a message</p>')
const currentTebSitemap = '<?xml version="1.0"?><urlset><url><loc>/web-design/</loc></url><url><loc>/marketing/</loc></url><url><loc>/blog/</loc></url></urlset>'

test('TEB validates current WordPress branding, relative sitemap and careers catch-all homepage', async () => {
  assert.equal(hasOfficialHomepageSignal(currentTebHome), true)
  assert.equal(hasOfficialPageSitemapSignal(currentTebSitemap), true)
  assert.equal(isVerifiedNoPublicJobsRoute({status:200,url:CAREERS_ROUTE_URLS[0],html:currentTebHome}), true)
  assert.deepEqual(await createTebSolutionsScraper().run({fetchPage:async url=>({status:200,url,html:url===PAGE_SITEMAP_URL?currentTebSitemap:currentTebHome})}), [])
  assert.equal(hasOfficialPageSitemapSignal(currentTebSitemap.replace('/blog/', 'https://unrelated.example/blog/')), false)
  assert.equal(hasOfficialPageSitemapSignal(currentTebSitemap.replace('</urlset>', '<url><loc>/careers/</loc></url></urlset>')), false)
  assert.equal(isVerifiedNoPublicJobsRoute({status:503,url:CAREERS_ROUTE_URLS[0],html:currentTebHome}), false)
  assert.equal(isVerifiedNoPublicJobsRoute({status:200,url:CAREERS_ROUTE_URLS[0],html:currentTebHome+'<h2>Current Openings</h2>'}), false)
})
