import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Yakria Technologies and Solutions scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>YTS | Brand &amp; Digital Design Agency - Yakria Technologies and Solutions</title>
    <meta
      name="description"
      content="YTS (Yakria Technologies and Solutions) is a top-tier branding and digital agency delivering purpose-driven design and identity solutions for growing brands. Headquartered in Chennai &amp; Coimbatore."
    />
    <link rel="canonical" href="https://www.ytechsol.com" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "legalName": "Yakria Technologies and Solutions",
        "contactPoint": [
          {
            "email": "info@ytechsol.com"
          }
        ],
        "sameAs": [
          "https://www.linkedin.com/company/ytechsol/"
        ]
      }
    </script>
  </head>
  <body>
    <a href="https://www.ytechsol.com/recruitment-services/">Recruitment Services</a>
    <p>Yakria Technologies and Solutions</p>
    <p>info@ytechsol.com</p>
  </body>
</html>
`

const recruitmentServicesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitment &amp; Staffing Services - Build Your Future Team | YTS</title>
    <meta
      name="description"
      content="Comprehensive staffing solutions tailored to your unique business needs. We don&#x27;t just fill roles, we build futures with the right people."
    />
    <link rel="canonical" href="https://www.ytechsol.com/recruitment-services" />
  </head>
  <body>
    <main>
      <h1>Recruitment &amp; Staffing Services</h1>
      <p>Comprehensive staffing solutions tailored to your unique business needs.</p>
      <p>Average placement in 21 days</p>
      <p>95% candidate retention rate after 12 months</p>
      <span>Technology &amp; IT</span>
    </main>
  </body>
</html>
`

const jobs404Html = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <main aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">Page Not Found</h1>
      <nav>
        <a href="https://www.ytechsol.com/">Home</a>
        <span>/jobs</span>
      </nav>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.ytechsol.com</loc>
  </url>
  <url>
    <loc>https://www.ytechsol.com/recruitment-services</loc>
  </url>
</urlset>
`

test('Yakria Technologies and Solutions sentinel pins the verified first-party no-public-jobs surface from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'yakriatechnologiesandsolutions')
  assert.equal(scraper.COMPANY, 'Yakria Technologies and Solutions')
  assert.equal(scraper.VERIFIED_ON, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.ytechsol.com/')
  assert.equal(scraper.RECRUITMENT_SERVICES_URL, 'https://www.ytechsol.com/recruitment-services')
  assert.equal(scraper.SITEMAP_URL, 'https://www.ytechsol.com/sitemap.xml')
  assert.deepEqual(scraper.CAREERS_ALIAS_URLS, [
    'https://www.ytechsol.com/careers',
    'https://www.ytechsol.com/careers/',
  ])
  assert.deepEqual(scraper.MISSING_JOBS_URLS, [
    'https://www.ytechsol.com/jobs',
    'https://www.ytechsol.com/jobs/',
  ])
  assert.match(scraper.VERIFIED_SURFACE_SUMMARY, /recruitment-services/i)
  assert.match(scraper.VERIFIED_SURFACE_SUMMARY, /no public jobs/i)

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialHomepageSignal('<html><body>Other company</body></html>'), false)

  assert.equal(scraper.hasOfficialRecruitmentServicesSignal(recruitmentServicesHtml), true)
  assert.equal(scraper.hasOfficialRecruitmentServicesSignal(homepageHtml), false)

  assert.equal(scraper.hasPublicJobsSignal(recruitmentServicesHtml), false)
  assert.equal(
    scraper.hasPublicJobsSignal('<a href="https://boards.greenhouse.io/ytechsol">Open positions</a>'),
    true,
  )

  assert.equal(
    scraper.isVerifiedCareersAlias({
      status: 200,
      url: 'https://www.ytechsol.com/recruitment-services#careers',
      html: recruitmentServicesHtml,
    }),
    true,
  )
  assert.equal(scraper.isVerifiedMissingJobsRoute(404, jobs404Html), true)
  assert.equal(scraper.isVerifiedMissingJobsRoute(200, jobs404Html), false)
  assert.equal(scraper.isVerifiedSitemap(sitemapXml), true)
  assert.equal(
    scraper.isVerifiedSitemap(`${sitemapXml}<loc>https://www.ytechsol.com/jobs</loc>`),
    false,
  )
})

test('Yakria Technologies and Solutions sentinel returns [] only while the verified first-party careers contract holds', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createYakriaTechnologiesAndSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === scraper.RECRUITMENT_SERVICES_URL) {
        return { status: 200, url, html: recruitmentServicesHtml }
      }

      if (scraper.CAREERS_ALIAS_URLS.includes(url)) {
        return {
          status: 200,
          url: 'https://www.ytechsol.com/recruitment-services#careers',
          html: recruitmentServicesHtml,
        }
      }

      if (scraper.MISSING_JOBS_URLS.includes(url)) {
        return {
          status: 404,
          url: 'https://www.ytechsol.com/jobs',
          html: jobs404Html,
        }
      }

      if (url === scraper.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      throw new Error(`Unexpected Yakria Technologies and Solutions URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.RECRUITMENT_SERVICES_URL,
    ...scraper.CAREERS_ALIAS_URLS,
    ...scraper.MISSING_JOBS_URLS,
    scraper.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Yakria Technologies and Solutions sentinel fails closed when the verified first-party surface drifts into a public jobs signal', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createYakriaTechnologiesAndSolutionsScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: scraper.HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected homepage</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    scraper.createYakriaTechnologiesAndSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.RECRUITMENT_SERVICES_URL) {
          return { status: 200, url, html: recruitmentServicesHtml }
        }

        return {
          status: 200,
          url: 'https://www.ytechsol.com/careers',
          html: '<html><body><a href="https://jobs.lever.co/ytechsol">Apply now</a></body></html>',
        }
      },
    }),
    /careers alias/i,
  )

  await assert.rejects(
    scraper.createYakriaTechnologiesAndSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.RECRUITMENT_SERVICES_URL) {
          return { status: 200, url, html: recruitmentServicesHtml }
        }

        if (scraper.CAREERS_ALIAS_URLS.includes(url)) {
          return {
            status: 200,
            url: 'https://www.ytechsol.com/recruitment-services#careers',
            html: recruitmentServicesHtml,
          }
        }

        return {
          status: 200,
          url: 'https://www.ytechsol.com/jobs',
          html: jobs404Html,
        }
      },
    }),
    /verified missing jobs route/i,
  )

  await assert.rejects(
    scraper.createYakriaTechnologiesAndSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraper.RECRUITMENT_SERVICES_URL) {
          return { status: 200, url, html: recruitmentServicesHtml }
        }

        if (scraper.CAREERS_ALIAS_URLS.includes(url)) {
          return {
            status: 200,
            url: 'https://www.ytechsol.com/recruitment-services#careers',
            html: recruitmentServicesHtml,
          }
        }

        if (scraper.MISSING_JOBS_URLS.includes(url)) {
          return {
            status: 404,
            url: 'https://www.ytechsol.com/jobs',
            html: jobs404Html,
          }
        }

        return {
          status: 200,
          url,
          html: `${sitemapXml}<loc>https://www.ytechsol.com/jobs</loc>`,
        }
      },
    }),
    /verified sitemap/i,
  )
})
