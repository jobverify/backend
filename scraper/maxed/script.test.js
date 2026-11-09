import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  HOMEPAGE_URL,
  INTERNSHIP_URL,
  MISSING_ROUTE_URLS,
  PAGE_SITEMAP_URL,
  SHARED_APPLY_URL,
  SOURCE,
  createMaxEdScraper,
  extractApplyUrl,
  extractPublicJobs,
  hasOfficialHomepageSignal,
  hasOfficialInternshipSignal,
  hasVerifiedInternshipLink,
  hasVerifiedPageSitemapSignal,
  isVerifiedMissingRoute,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Research and Consulting | MaxEd</title>
    </head>
    <body>
      <div class="top-bar">
        <span>Cochin, Kerala</span>
      </div>
      <nav>
        <a href="https://maxed.in/about-us/">About Us</a>
        <a href="https://maxed.in/services/">Services</a>
        <a href="https://maxed.in/internship/">Internship</a>
      </nav>
      <section>
        <h2>Work Together for Business Success</h2>
        <p>MaxEd, an initiative from i-miRa Knowledge Solutions offers data analytics and curated market intelligence solutions for MSMEs and fast growing brands across South India.</p>
        <p>Conducted the largest opinion survey in Kerala</p>
        <p>90+ research projects across Kerala, Karnataka, Tamil Nadu, Telangana, and Andhra Pradesh</p>
        <p>First company to publish Kerala-specific Industry Sector Reports</p>
      </section>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://maxed.in/</loc></url>
    <url><loc>https://maxed.in/about-us/</loc></url>
    <url><loc>https://maxed.in/internship-dashboard/</loc></url>
    <url><loc>https://maxed.in/internship/</loc></url>
  </urlset>
`

const internshipHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Internship - MaxEd - Best Market Research Agency</title>
    </head>
    <body>
      <main>
        <h2>Internship</h2>
        <h3>Launch Your Career with the MaxEd Internship Program</h3>
        <p>
          The MaxEd Internship Program is your gateway to a rewarding career in
          market research, data analytics, and HR operations.
        </p>
        <p><strong>Key Benefits of the Program:</strong></p>
        <p><strong>Hands-On Learning:</strong> Work on real-world projects and develop practical skills.</p>
        <p><strong>Mentorship:</strong> Gain guidance and expertise from seasoned professionals.</p>
        <p><strong>Diverse Exposure:</strong> Explore multiple domains to find your passion.</p>
        <p><strong>Networking Opportunities:</strong> Build connections with industry leaders.</p>
        <p><strong>Career Development:</strong> Strengthen your resume and prepare for a successful career.</p>
        <p>Your future starts here.</p>
        <a href="${SHARED_APPLY_URL}">Apply Now</a>
      </main>
    </body>
  </html>
`

const missingRouteHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Page not found - MaxEd - Best Market Research Agency</title>
    </head>
    <body>
      <h1>Page not found</h1>
      <p>The page can't be found.</p>
      <nav>Explore Business Events Services About</nav>
    </body>
  </html>
`

test('MaxEd recognizes the verified homepage, page sitemap, internship page, and missing-route shell', () => {
  assert.equal(SOURCE, 'maxed')
  assert.equal(COMPANY, 'MaxEd')
  assert.equal(HOMEPAGE_URL, 'https://maxed.in/')
  assert.equal(PAGE_SITEMAP_URL, 'https://maxed.in/page-sitemap.xml')
  assert.equal(INTERNSHIP_URL, 'https://maxed.in/internship/')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://maxed.in/careers/',
    'https://maxed.in/jobs/',
  ])
  assert.equal(hasVerifiedInternshipLink(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedPageSitemapSignal(pageSitemapXml), true)
  assert.equal(extractApplyUrl(internshipHtml), SHARED_APPLY_URL)
  assert.equal(hasOfficialInternshipSignal(internshipHtml), true)
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
      url: MISSING_ROUTE_URLS[0],
    }),
    true,
  )
})

test('MaxEd extracts the verified public internship program with the shared apply route', () => {
  const jobs = extractPublicJobs(internshipHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Internship Program',
      company: COMPANY,
      department: 'Internship',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'maxed-internship-program',
      requisitionId: 'maxed-internship',
      sourceUrl: INTERNSHIP_URL,
      applyUrl: SHARED_APPLY_URL,
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Launch your career with the MaxEd Internship Program across market research, data analytics, and HR operations. The verified public program highlights hands-on learning, mentorship, diverse exposure, networking opportunities, and career development.',
      remoteStatus: null,
    },
  ])
})

test('MaxEd run() validates the verified public internship surface end-to-end', async () => {
  const requestedUrls = []

  const jobs = await createMaxEdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (url === INTERNSHIP_URL) {
        return { status: 200, url, html: internshipHtml }
      }

      if (MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    PAGE_SITEMAP_URL,
    INTERNSHIP_URL,
    ...MISSING_ROUTE_URLS,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Internship Program')
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].applyUrl, SHARED_APPLY_URL)
})

test('MaxEd fails closed when the internship page or missing-route behavior drifts', async () => {
  await assert.rejects(
    createMaxEdScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === INTERNSHIP_URL) {
          return {
            status: 200,
            url,
            html: internshipHtml.replace(SHARED_APPLY_URL, 'https://docs.google.com/forms/d/e/example/viewform'),
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified official public opportunity surface|verified shared google form apply route/i,
  )

  await assert.rejects(
    createMaxEdScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === INTERNSHIP_URL) {
          return { status: 200, url, html: internshipHtml }
        }

        return { status: 200, url, html: internshipHtml }
      },
    }),
    /missing-route behavior changed materially/i,
  )
})
