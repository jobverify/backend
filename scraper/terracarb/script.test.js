import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Terracarb &#8211; Reimagining Graphene</title>
    <meta name="description" content="Graphene innovation for sustainable development." />
  </head>
  <body>
    <main>
      <h1>Graphene Innovation for Sustainable Development</h1>
      <p>Terracarb Pvt Ltd, 13, Sundaresa Iyer Layout, Trichy Road, Coimbatore - 641018</p>
      <p>info@terracarb.com</p>
      <a href="/work-with-us/">Work With Us</a>
    </main>
  </body>
</html>
`

const workWithUsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Work With Us &#8211; Terracarb</title>
  </head>
  <body>
    <main>
      <h1>Work With Us</h1>
      <h2>Join Our Team</h2>
      <p>Passionate about what we do? Let’s explore how you can be part of our dynamic team!</p>
      <p>reimagine@terracarb.com</p>
      <p>info@terracarb.com</p>
      <p>+91 99943 37928</p>
      <p>Terracarb Pvt Ltd, 13, Sundaresar Layout, Trichy Road, Coimbatore - 641018</p>
      <label>Upload Resume</label>
      <button>Send Message</button>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://terracarb.com/</loc></url>
  <url><loc>https://terracarb.com/about-us/</loc></url>
  <url><loc>https://terracarb.com/work-with-us/</loc></url>
  <url><loc>https://terracarb.com/products/</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://terracarb.com/careers',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Page not found &#8211; Terracarb</title>
      </head>
      <body>
        <h1>Oops! That page can’t be found.</h1>
        <p>It looks like nothing was found at this location.</p>
      </body>
    </html>
  `,
}

const publicJobsSurfaceHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Work With Us &#8211; Terracarb</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/terracarb/materials-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Terracarb scraper module at ./script.js')
  }
}

test('Terracarb sentinel recognizes the verified homepage, work-with-us page, sitemap, and missing job routes', async () => {
  const terracarb = await loadModule()

  assert.equal(terracarb.SOURCE, 'terracarb')
  assert.equal(terracarb.COMPANY, 'Terracarb')
  assert.equal(terracarb.HOMEPAGE_URL, 'https://terracarb.com/')
  assert.equal(terracarb.WORK_WITH_US_URL, 'https://terracarb.com/work-with-us/')
  assert.equal(terracarb.SITEMAP_URL, 'https://terracarb.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(terracarb.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://terracarb.com/careers',
    'https://terracarb.com/careers/',
    'https://terracarb.com/career',
    'https://terracarb.com/career/',
    'https://terracarb.com/jobs',
    'https://terracarb.com/jobs/',
    'https://terracarb.com/openings',
    'https://terracarb.com/openings/',
  ])

  assert.equal(terracarb.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(terracarb.hasOfficialWorkWithUsSignal(workWithUsHtml), true)
  assert.equal(terracarb.hasFirstPartyWorkWithUsLink(homepageHtml), true)
  assert.equal(terracarb.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(terracarb.hasPublicJobsSignal(workWithUsHtml), false)
  assert.equal(terracarb.sitemapIncludesVerifiedWorkWithUsRoute(sitemapXml), true)
  assert.equal(terracarb.sitemapHasUnexpectedJobRoute(sitemapXml), false)
  assert.equal(terracarb.isVerifiedMissingJobRoute(missingCareerRoutePage), true)
})

test('Terracarb sentinel returns no jobs only while the verified first-party work-with-us flow remains unchanged', async () => {
  const terracarb = await loadModule()
  const requestedUrls = []

  const jobs = await terracarb.createTerracarbScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === terracarb.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === terracarb.WORK_WITH_US_URL) return { status: 200, url, html: workWithUsHtml }
      if (url === terracarb.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (terracarb.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    terracarb.HOMEPAGE_URL,
    terracarb.WORK_WITH_US_URL,
    terracarb.SITEMAP_URL,
    ...terracarb.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Terracarb sentinel fails closed when the verified no-public-jobs surface drifts', async () => {
  const terracarb = await loadModule()

  await assert.rejects(
    terracarb.createTerracarbScraper().run({
      fetchPage: async (url) => {
        if (url === terracarb.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    terracarb.createTerracarbScraper().run({
      fetchPage: async (url) => {
        if (url === terracarb.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === terracarb.WORK_WITH_US_URL) {
          return { status: 200, url, html: publicJobsSurfaceHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /work-with-us page|public jobs surface/i,
  )

  await assert.rejects(
    terracarb.createTerracarbScraper().run({
      fetchPage: async (url) => {
        if (url === terracarb.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === terracarb.WORK_WITH_US_URL) return { status: 200, url, html: workWithUsHtml }
        if (url === terracarb.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://terracarb.com/careers</loc></url></urlset>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    terracarb.createTerracarbScraper().run({
      fetchPage: async (url) => {
        if (url === terracarb.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === terracarb.WORK_WITH_US_URL) return { status: 200, url, html: workWithUsHtml }
        if (url === terracarb.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === terracarb.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsSurfaceHtml }
        }
        if (terracarb.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party job route changed|public jobs surface/i,
  )
})
