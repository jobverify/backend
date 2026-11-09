import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>eCommerce Logistics Shipping Solutions & Courier Aggregator India | Pickrr</title>
    <meta
      name="description"
      content="Pickrr is India's largest ecommerce logistics solution & shipping software for professional courier aggregator services. Take advantage of our real-time order tracking, cash on delivery (COD) features & make your shipping experience hassle-free."
    />
    <link rel="canonical" href="https://www.pickrr.com/" />
  </head>
  <body>
    <header>
      <div>Get Guaranteed Rs.300 Cashback on Your First Recharge With Pickrr</div>
      <a href="https://dashboard.pickrr.com/">Free Sign Up</a>
    </header>
    <main>
      <h1>Pickrr</h1>
      <p>3rd & 4th floor, Enkay Square, 448-A, Udyog Vihar Phase V, Gurugram, Haryana 122022</p>
      <p>support@pickrr.com</p>
      <a href="/life-at-pickrr">Life at Pickrr</a>
    </main>
  </body>
</html>
`

const lifeAtPickrrHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at Pickrr - Grow your Career with Pickrr</title>
    <meta
      name="description"
      content="Pickrr believes that each one of us should be able to find our dream career. Join us and become a part of Pickrr's growth story. Send us your resume today!"
    />
    <link rel="canonical" href="https://pickrr.com/life-at-pickrr/" />
  </head>
  <body>
    <main>
      <h1>Come join us be a part of Pickrr Growth Story</h1>
      <h2>Life at Pickrr</h2>
      <p>Our vision is to make shipping simple and seamless for businesses across the globe.</p>
      <section>
        <h3>Send us your Resume, we’ll get back to you</h3>
        <label for="partner-resume">Upload your resume</label>
        <a href="" id="partner-form-submit">Submit</a>
      </section>
    </main>
    <!--
    <section class="careers-section" id="career-section-box">
      <a href="../../scraper/job-post/product-manager" class="job-post">
        <span class="job-role">Product Manager</span>
        <span>2-10 Years</span>
        <span>New Delhi (WFH)</span>
      </a>
    </section>
    -->
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found - Pickrr</title>
  </head>
  <body>
    <main>
      <h1>Uh-oh! You’re lost</h1>
      <p>The page you are looking for does not exist...</p>
      <a href="https://pickrr.com/">Home</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.pickrr.com/</loc></url>
  <url><loc>https://www.pickrr.com/product/</loc></url>
  <url><loc>https://www.pickrr.com/life-at-pickrr/</loc></url>
  <url><loc>https://www.pickrr.com/get-in-touch/</loc></url>
</urlset>
`

const sitemapWithCareers = `
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.pickrr.com/</loc></url>
  <url><loc>https://www.pickrr.com/life-at-pickrr/</loc></url>
  <url><loc>https://www.pickrr.com/careers</loc></url>
</urlset>
`

const lifeAtPickrrWithVisibleJobsHtml = `
${lifeAtPickrrHtml.replace(
  '</main>',
  `
    <section class="careers-section">
      <a href="../../scraper/job-post/product-manager" class="job-post">
        <span class="job-role">Product Manager</span>
        <span>2-10 Years</span>
        <span>New Delhi (WFH)</span>
      </a>
      <a href="https://jobs.lever.co/pickrr">Apply now</a>
    </section>
  </main>`,
)}
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pickrr/script.js')
  } catch {
    assert.fail('Expected Pickrr scraper module at ../../scraper/pickrr/script.js')
  }
}

test('Pickrr sentinel pins the verified homepage, sitemap, life-at-pickrr page, and careers 404 contract', async () => {
  const pickrr = await loadModule()

  assert.equal(pickrr.SOURCE, 'pickrr')
  assert.equal(pickrr.COMPANY, 'Pickrr')
  assert.equal(pickrr.OFFICIAL_BRAND_NAME, 'Pickrr')
  assert.equal(pickrr.VERIFIED_ON, '2026-08-13')
  assert.equal(pickrr.HOMEPAGE_URL, 'https://pickrr.com/')
  assert.equal(pickrr.CAREERS_LANDING_URL, 'https://pickrr.com/life-at-pickrr/')
  assert.equal(pickrr.SITEMAP_URL, 'https://pickrr.com/sitemap.xml')
  assert.equal(pickrr.CAREERS_404_URL, 'https://pickrr.com/careers')
  assert.deepEqual(pickrr.FIRST_PARTY_TIMEOUT_URLS, [
    'https://pickrr.com/',
    'https://pickrr.com/sitemap.xml',
    'https://pickrr.com/life-at-pickrr/',
    'https://pickrr.com/careers',
  ])
  assert.match(pickrr.VERIFIED_SURFACE_SUMMARY, /repeated connect timeouts/i)

  assert.equal(pickrr.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(pickrr.hasVerifiedLifeAtPickrrSignal(lifeAtPickrrHtml), true)
  assert.equal(pickrr.hasVerifiedNotFoundCareersSignal(careers404Html), true)
  assert.equal(pickrr.sitemapHasLifeAtPickrrRoute(sitemapXml), true)
  assert.equal(pickrr.sitemapHasPublicCareersRoute(sitemapXml), false)
  assert.equal(pickrr.sitemapHasPublicCareersRoute(sitemapWithCareers), true)
  assert.equal(pickrr.hasPublicJobsSignal(lifeAtPickrrHtml), false)
  assert.equal(pickrr.hasPublicJobsSignal(lifeAtPickrrWithVisibleJobsHtml), true)
  assert.equal(pickrr.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(pickrr.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
  assert.doesNotMatch(pickrr.stripHtmlComments(lifeAtPickrrHtml), /Product Manager/i)
})

test('Pickrr returns [] when the current verified first-party routes all time out', async () => {
  const pickrr = await loadModule()
  const requestedUrls = []

  const jobs = await pickrr.createPickrrScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, pickrr.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('Pickrr returns [] only while the official life-at-pickrr page remains a resume-form surface without public jobs', async () => {
  const pickrr = await loadModule()
  const requestedUrls = []

  const jobs = await pickrr.createPickrrScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pickrr.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === pickrr.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === pickrr.CAREERS_LANDING_URL) {
        return { status: 200, url, html: lifeAtPickrrHtml }
      }

      if (url === pickrr.CAREERS_404_URL) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Pickrr URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pickrr.HOMEPAGE_URL,
    pickrr.SITEMAP_URL,
    pickrr.CAREERS_LANDING_URL,
    pickrr.CAREERS_404_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Pickrr fails closed when the official careers form surface drifts into public jobs or route contracts change', async () => {
  const pickrr = await loadModule()

  await assert.rejects(
    pickrr.createPickrrScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: '<html><body><h1>Pickrr</h1></body></html>' }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    pickrr.createPickrrScraper().run({
      fetchPage: async (url) => {
        if (url === pickrr.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === pickrr.SITEMAP_URL) {
          return { status: 200, url, html: sitemapWithCareers }
        }
        if (url === pickrr.CAREERS_LANDING_URL) {
          return { status: 200, url, html: lifeAtPickrrHtml }
        }
        return { status: 404, url, html: careers404Html }
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    pickrr.createPickrrScraper().run({
      fetchPage: async (url) => {
        if (url === pickrr.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === pickrr.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === pickrr.CAREERS_LANDING_URL) {
          return { status: 200, url, html: lifeAtPickrrWithVisibleJobsHtml }
        }
        return { status: 404, url, html: careers404Html }
      },
    }),
    /public jobs/i,
  )

  await assert.rejects(
    pickrr.createPickrrScraper().run({
      fetchPage: async (url) => {
        if (url === pickrr.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === pickrr.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === pickrr.CAREERS_LANDING_URL) {
          return { status: 200, url, html: lifeAtPickrrHtml }
        }
        return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
      },
    }),
    /not-found/i,
  )
})
