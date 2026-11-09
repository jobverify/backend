import assert from 'node:assert/strict'
import test from 'node:test'

const loadAlokIndustriesModule = async () => {
  try {
    return await import('../../scraper/alokindustries/script.js')
  } catch {
    assert.fail('Expected Alok Industries scraper module at ../../scraper/alokindustries/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Quality Fabric & Textile Manufacturing Company In India | Largest Fully Integrated & Cutting Edge Solutions - Alok Industries</title>
  </head>
  <body>
    <header>
      <nav>
        <a class="nav-link" href="vision-mission-value.html">Who We Are</a>
        <a class="nav-link" href="careers.html">Careers</a>
        <a class="nav-link" href="marketing-offices.html">Reach Us</a>
      </nav>
    </header>
    <main>
      <h5>Welcome to Alok Industries Limited</h5>
      <h1>India's Largest Vertically Integrated Textile Company</h1>
      <section>
        <h2>About Us</h2>
        <p>Alok Industries Limited is one of India’s largest vertically integrated textile companies offering end-to-end solutions.</p>
      </section>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Alok Industries</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>At Alok Industries, we believe that our strength lies in our people.</p>
      <p>
        Joining Alok Industries means becoming a part of a vibrant community where creativity,
        excellence, and sustainability converge.
      </p>
      <h2>Our Work Values</h2>
      <p>Reliable</p>
      <p>Innovation</p>
      <p>Results-oriented environment</p>
      <p>Teamwork</p>
      <p>Adaptability</p>
      <p>Recognizing and nurturing talent</p>
      <p>
        Take the first step towards an extraordinary career, email us at:
        <a href="mailto:resume@alokind.com">resume@alokind.com</a>
      </p>
    </main>
  </body>
</html>
`

const missingJobRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Alok Industries</title>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Alok Industries</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Merchandiser"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/jobs/merchandiser">Apply now</a>
    </main>
  </body>
</html>
`

test('Alok Industries sentinels stay pinned to the verified homepage, resume-only careers page, and missing job routes', async () => {
  const alokIndustries = await loadAlokIndustriesModule()

  assert.equal(alokIndustries.SOURCE, 'alokindustries')
  assert.equal(alokIndustries.COMPANY, 'Alok Industries')
  assert.equal(alokIndustries.VERIFIED_AT, '2026-07-15')
  assert.equal(alokIndustries.HOMEPAGE_URL, 'https://www.alokind.com/')
  assert.equal(alokIndustries.CAREERS_URL, 'https://www.alokind.com/careers.html')
  assert.equal(alokIndustries.ROBOTS_TXT_URL, 'https://www.alokind.com/robots.txt')
  assert.equal(alokIndustries.SITEMAP_URL, 'https://www.alokind.com/sitemap.xml')
  assert.equal(alokIndustries.RESUME_EMAIL, 'resume@alokind.com')
  assert.deepEqual(alokIndustries.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.alokind.com/careers',
    'https://www.alokind.com/jobs',
    'https://www.alokind.com/join-us',
    'https://www.alokind.com/openings',
    'https://www.alokind.com/current-openings',
  ])

  assert.equal(alokIndustries.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    alokIndustries.extractHomepageCareerUrl(homepageHtml),
    'https://www.alokind.com/careers.html',
  )
  assert.equal(alokIndustries.hasResumeOnlyCareersSignal(careersHtml), true)
  assert.equal(alokIndustries.hasPublicJobListingSignal(careersHtml), false)
  assert.equal(alokIndustries.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    alokIndustries.isKnownMissingJobRoute(
      { status: 404, url: 'https://www.alokind.com/jobs', html: missingJobRouteHtml },
      'https://www.alokind.com/jobs',
    ),
    true,
  )
})

test('Alok Industries returns no jobs only while the verified first-party careers surface remains resume-only', async () => {
  const alokIndustries = await loadAlokIndustriesModule()
  const requestedUrls = []

  const jobs = await alokIndustries.createAlokIndustriesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === alokIndustries.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === alokIndustries.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (alokIndustries.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingJobRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    alokIndustries.HOMEPAGE_URL,
    alokIndustries.CAREERS_URL,
    ...alokIndustries.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Alok Industries fails closed when the verified homepage, careers page, or missing job routes drift', async () => {
  const alokIndustries = await loadAlokIndustriesModule()

  await assert.rejects(
    alokIndustries.createAlokIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === alokIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    alokIndustries.createAlokIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === alokIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === alokIndustries.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface|resume-only careers surface/i,
  )

  await assert.rejects(
    alokIndustries.createAlokIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === alokIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === alokIndustries.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === alokIndustries.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Careers hub</body></html>' }
        }

        if (alokIndustries.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})
