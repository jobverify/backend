import assert from 'node:assert/strict'
import test from 'node:test'

const blockedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GoDaddy Security - Access Denied</title>
  </head>
  <body>
    <h1>Access Denied - GoDaddy Website Firewall</h1>
    <table>
      <tr><td>URL:</td><td><span>www.astramwp.com/</span></td></tr>
      <tr><td>Block ID:</td><td><span>DDOS22</span></td></tr>
      <tr><td>Block reason:</td><td><span>DDOS attempt was blocked.</span></td></tr>
    </table>
  </body>
</html>
`

const sucuriJavascriptGateHtml = `
<html>
  <title>You are being redirected...</title>
  <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
  <body>
    <script>Sucuri CloudProxy</script>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /wp-content/uploads/wc-logs/
Disallow: /wp-content/uploads/woocommerce_transient_files/
Disallow: /wp-content/uploads/woocommerce_uploads/
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://astramwp.com/wp-sitemap.xml
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="https://astramwp.com/wp-sitemap-index.xsl" ?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://astramwp.com/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://astramwp.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://astramwp.com/wp-sitemap-posts-product-1.xml</loc></sitemap>
  <sitemap><loc>https://astramwp.com/wp-sitemap-users-1.xml</loc></sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://astramwp.com/</loc></url>
  <url><loc>https://astramwp.com/contact-us/</loc></url>
  <url><loc>https://astramwp.com/about-ampl/</loc></url>
  <url><loc>https://astramwp.com/our-culture/</loc></url>
  <url><loc>https://astramwp.com/learning-development/</loc></url>
  <url><loc>https://astramwp.com/post-resume/</loc></url>
  <url><loc>https://astramwp.com/post-resume-2/</loc></url>
</urlset>
`

const resumeOnlyCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Post Resume &#8211; Astra Microwave Products Ltd.</title>
  </head>
  <body>
    <header>
      <a href="mailto:mktg@astramwp.com">mktg@astramwp.com</a>
      <a href="mailto:hr@astramwp.com">hr@astramwp.com</a>
      <a href="/our-culture/">Our Culture</a>
      <a href="/why-amp/">Why AMP</a>
      <a href="/learning-development/">Learning &amp; Development</a>
      <a href="/post-resume/">Post Resume</a>
    </header>
    <main>
      <h2>Astra Microwave Products Ltd.</h2>
      <h3>Post Resume</h3>
      <h4>Post Your Resume</h4>
      <p>Complete the Form Below and Get Started Today!</p>
      <form action="/post-resume/#wpcf7-f5574-p5518-o2" method="post" enctype="multipart/form-data">
        <input placeholder="Name" type="text" name="text-814" />
        <input placeholder="E-Mail" type="email" name="email-702" />
        <input placeholder="Mobile" type="number" name="number-648" />
        <input placeholder="Education" type="text" name="text-815" />
        <input class="resume-file" accept=".pdf,.svg,.png,.jpg" type="file" name="file-574" />
        <input type="submit" value="Submit" />
      </form>
    </main>
  </body>
</html>
`

const blockedJobRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GoDaddy Security - Access Denied</title>
  </head>
  <body>
    <h1>Access Denied - GoDaddy Website Firewall</h1>
    <table>
      <tr><td>URL:</td><td><span>www.astramwp.com/careers</span></td></tr>
      <tr><td>Block ID:</td><td><span>DDOS22</span></td></tr>
      <tr><td>Block reason:</td><td><span>DDOS attempt was blocked.</span></td></tr>
    </table>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found &#8211; Astra Microwave Products Ltd.</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <a href="mailto:mktg@astramwp.com">mktg@astramwp.com</a>
    <a href="mailto:hr@astramwp.com">hr@astramwp.com</a>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Astra Microwave Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"RF Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/astramwp/rf-engineer">Apply now</a>
  </body>
</html>
`

const driftedPageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://astramwp.com/</loc></url>
  <url><loc>https://jobs.lever.co/astramwp</loc></url>
</urlset>
`

const loadAstraMicrowaveModule = async () => {
  try {
    return await import('../../scraper/astramicrowave/script.js')
  } catch {
    assert.fail('Expected Astra Microwave scraper module at ../../scraper/astramicrowave/script.js')
  }
}

test('Astra Microwave scraper constants stay pinned to the verified first-party nonlisting careers surface', async () => {
  const astra = await loadAstraMicrowaveModule()

  assert.equal(astra.SOURCE, 'astramicrowave')
  assert.equal(astra.COMPANY, 'Astra Microwave')
  assert.equal(astra.OFFICIAL_BRAND_NAME, 'Astra Microwave Products Ltd.')
  assert.equal(astra.VERIFIED_ON, '2026-07-15')
  assert.equal(astra.HOMEPAGE_URL, 'https://www.astramwp.com/')
  assert.equal(astra.CAREERS_URL, 'https://astramwp.com/post-resume/')
  assert.equal(astra.CAREERS_ALIAS_URL, 'https://astramwp.com/post-resume-2/')
  assert.equal(astra.ROBOTS_URL, 'https://www.astramwp.com/robots.txt')
  assert.equal(astra.SITEMAP_INDEX_URL, 'https://astramwp.com/wp-sitemap.xml')
  assert.equal(astra.PAGE_SITEMAP_URL, 'https://astramwp.com/wp-sitemap-posts-page-1.xml')
  assert.equal(astra.APPLICATION_EMAIL, 'hr@astramwp.com')
  assert.equal(astra.APPLICATION_URL, 'mailto:hr@astramwp.com')
  assert.deepEqual(astra.BLOCKED_JOB_ROUTE_URLS, [
    'https://www.astramwp.com/careers',
    'https://www.astramwp.com/career',
    'https://www.astramwp.com/jobs',
    'https://www.astramwp.com/join-us',
    'https://www.astramwp.com/openings',
  ])
  assert.deepEqual(astra.MISSING_JOB_ROUTE_URLS, [
    'https://www.astramwp.com/work-with-us',
  ])
  assert.match(astra.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(astra.isGoDaddyFirewallBlockedPage({
    status: 403,
    url: astra.HOMEPAGE_URL,
    html: blockedHomepageHtml,
  }), true)
  assert.equal(astra.hasOfficialRobotsTxtSignal(robotsTxt), true)
  assert.equal(astra.hasOfficialSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(astra.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(astra.hasResumeOnlyCareersSignal(resumeOnlyCareersHtml), true)
  assert.equal(astra.pageExposesPublicJobListings(resumeOnlyCareersHtml), false)
  assert.equal(astra.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(astra.isBlockedJobRoute({
    status: 403,
    url: astra.BLOCKED_JOB_ROUTE_URLS[0],
    html: blockedJobRouteHtml,
  }), true)
  assert.equal(astra.isMissingJobRoute({
    status: 404,
    url: astra.MISSING_JOB_ROUTE_URLS[0],
    html: missingRouteHtml,
  }), true)
})

test('Astra Microwave returns [] only while the verified first-party careers section remains a nonlisting resume flow', async () => {
  const astra = await loadAstraMicrowaveModule()
  const requestedUrls = []

  const jobs = await astra.createAstraMicrowaveScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === astra.HOMEPAGE_URL) {
        return { status: 403, url, html: blockedHomepageHtml }
      }

      if (url === astra.ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === astra.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === astra.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (url === astra.CAREERS_URL || url === astra.CAREERS_ALIAS_URL) {
        return { status: 200, url, html: resumeOnlyCareersHtml }
      }

      if (astra.BLOCKED_JOB_ROUTE_URLS.includes(url)) {
        return { status: 403, url, html: blockedJobRouteHtml }
      }

      if (astra.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Astra Microwave URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    astra.HOMEPAGE_URL,
    astra.ROBOTS_URL,
    astra.SITEMAP_INDEX_URL,
    astra.PAGE_SITEMAP_URL,
    astra.CAREERS_URL,
    astra.CAREERS_ALIAS_URL,
    ...astra.BLOCKED_JOB_ROUTE_URLS,
    ...astra.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Astra Microwave returns [] when the official pages are behind the current Sucuri javascript gate and sitemaps expose no jobs', async () => {
  const astra = await loadAstraMicrowaveModule()
  const requestedUrls = []

  const jobs = await astra.createAstraMicrowaveScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === astra.ROBOTS_URL) {
        return { status: 200, url: 'https://astramwp.com/robots.txt', html: robotsTxt }
      }

      if (url === astra.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === astra.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      return { status: 307, url, html: sucuriJavascriptGateHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    astra.HOMEPAGE_URL,
    astra.ROBOTS_URL,
    astra.SITEMAP_INDEX_URL,
    astra.PAGE_SITEMAP_URL,
    astra.CAREERS_URL,
    astra.CAREERS_ALIAS_URL,
    ...astra.BLOCKED_JOB_ROUTE_URLS,
    ...astra.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Astra Microwave fails closed when the verified homepage, sitemap, careers pages, or adjacent job routes drift into a listings surface', async () => {
  const astra = await loadAstraMicrowaveModule()

  await assert.rejects(
    astra.createAstraMicrowaveScraper().run({
      fetchPage: async (url) => {
        if (url === astra.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Astra Microwave URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    astra.createAstraMicrowaveScraper().run({
      fetchPage: async (url) => {
        if (url === astra.HOMEPAGE_URL) {
          return { status: 403, url, html: blockedHomepageHtml }
        }

        if (url === astra.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /\n' }
        }

        throw new Error(`Unexpected Astra Microwave URL: ${url}`)
      },
    }),
    /robots\.txt/i,
  )

  await assert.rejects(
    astra.createAstraMicrowaveScraper().run({
      fetchPage: async (url) => {
        if (url === astra.HOMEPAGE_URL) {
          return { status: 403, url, html: blockedHomepageHtml }
        }

        if (url === astra.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === astra.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === astra.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: driftedPageSitemapXml }
        }

        throw new Error(`Unexpected Astra Microwave URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )

  await assert.rejects(
    astra.createAstraMicrowaveScraper().run({
      fetchPage: async (url) => {
        if (url === astra.HOMEPAGE_URL) {
          return { status: 403, url, html: blockedHomepageHtml }
        }

        if (url === astra.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === astra.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === astra.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === astra.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Astra Microwave URL: ${url}`)
      },
    }),
    /resume-only careers page|public job listings/i,
  )

  await assert.rejects(
    astra.createAstraMicrowaveScraper().run({
      fetchPage: async (url) => {
        if (url === astra.HOMEPAGE_URL) {
          return { status: 403, url, html: blockedHomepageHtml }
        }

        if (url === astra.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === astra.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === astra.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === astra.CAREERS_URL || url === astra.CAREERS_ALIAS_URL) {
          return { status: 200, url, html: resumeOnlyCareersHtml }
        }

        if (url === astra.BLOCKED_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (astra.BLOCKED_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 403, url, html: blockedJobRouteHtml }
        }

        if (astra.MISSING_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected Astra Microwave URL: ${url}`)
      },
    }),
    /blocked job route/i,
  )
})
