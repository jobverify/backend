import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sahaj Retail Limited | India’s Largest Rural Digital & Financial Services Network - Sahaj 2025 - Sahaj</title>
  </head>
  <body>
    <h1>Sahaj Retail Limited</h1>
    <a href="https://retail.sahaj.co.in/joinuspage">Register Now</a>
    <p>JOIN US</p>
    <p>Why partner with Sahaj?</p>
    <p>Sahaj Mitr (Retailer)</p>
    <p>support@sahaj.co.in</p>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>"About Sahaj - Transforming Lives through Compassion and Innovation" - Sahaj 2025 - Sahaj</title>
  </head>
  <body>
    <h2>About Us</h2>
    <p>Sahaj Retail Limited, has delved into bridging the digital divide between Urban and Rural India under the flagship of NeGP of Government of India.</p>
    <p>At Sahaj, we firmly believe in our Core Values</p>
    <p>Meet Our Leadership</p>
  </body>
</html>
`

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Become a Sahaj Mitr | Join Sahaj Retail Limited - Sahaj</title>
  </head>
  <body>
    <h1>Applicant Registration</h1>
    <p>Mobile Number with OTP Verification</p>
    <p>Valid PAN Card (Linked with Aadhaar)</p>
    <p>Why partner with Sahaj?</p>
    <p>Become a Sahaj Mitr today and help rural people access Government services easily.</p>
    <p>support@sahaj.co.in</p>
  </body>
</html>
`

const jobRoleHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Role page - Sahaj 2025 - Sahaj</title>
  </head>
  <body>
    <h1>Job Role</h1>
    <p>Sahaj has tie ups with the organization those required skilled & unskilled manpower and creating the leads for them.</p>
    <p>Presently 30 job roles are on the portal under jobs tab in e-learning section like Driver, Electrician, Plumber & Security Guard etc.</p>
    <p>Candidates registered yourself on the job role as per the qualification & interest to get the job.</p>
    <a href="https://retail.sahaj.co.in/joinuspage">Register Now</a>
  </body>
</html>
`

const publicCompanyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Role page - Sahaj 2025 - Sahaj</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
    </script>
  </head>
  <body>
    <h1>Job Role</h1>
    <p>Sahaj has tie ups with the organization those required skilled & unskilled manpower and creating the leads for them.</p>
    <p>Presently 30 job roles are on the portal under jobs tab in e-learning section like Driver, Electrician, Plumber & Security Guard etc.</p>
    <p>Candidates registered yourself on the job role as per the qualification & interest to get the job.</p>
    <h1>Current Openings</h1>
    <a href="/careers/software-engineer">Apply Now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sahaj/script.js')
  } catch {
    assert.fail('Expected Sahaj scraper module at ../../scraper/sahaj/script.js')
  }
}

test('Sahaj sentinel helpers stay pinned to the verified exact-name partner and job-seeker contract', async () => {
  const sahaj = await loadModule()

  assert.equal(sahaj.SOURCE, 'sahaj')
  assert.equal(sahaj.COMPANY, 'Sahaj')
  assert.equal(sahaj.OFFICIAL_BRAND_NAME, 'Sahaj Retail Limited')
  assert.equal(sahaj.VERIFIED_ON, '2026-07-17')
  assert.equal(sahaj.HOMEPAGE_URL, 'https://www.sahaj.co.in/')
  assert.equal(sahaj.ABOUT_PAGE_URL, 'https://retail.sahaj.co.in/web/retail/about-us')
  assert.equal(sahaj.JOIN_US_URL, 'https://retail.sahaj.co.in/joinuspage')
  assert.equal(sahaj.JOB_ROLE_URL, 'https://retail.sahaj.co.in/web/retail/job-role-page')
  assert.equal(
    sahaj.extractHomepageJoinUsUrl(homepageHtml),
    'https://retail.sahaj.co.in/joinuspage',
  )
  assert.equal(sahaj.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sahaj.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(sahaj.hasOfficialJoinUsSignal(joinUsHtml), true)
  assert.equal(sahaj.hasOfficialJobRoleSignal(jobRoleHtml), true)
  assert.equal(sahaj.hasPublicCompanyJobsSignal(jobRoleHtml), false)
  assert.equal(sahaj.hasPublicCompanyJobsSignal(publicCompanyJobsHtml), true)
  assert.match(sahaj.VERIFIED_SURFACE_SUMMARY, /no trustworthy public company jobs surface/i)
})

test('Sahaj sentinel returns [] only while the verified first-party surfaces remain non-corporate-job pages', async () => {
  const sahaj = await loadModule()
  const requestedUrls = []

  const jobs = await sahaj.createSahajScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sahaj.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === sahaj.ABOUT_PAGE_URL) return { status: 200, url, html: aboutHtml }
      if (url === sahaj.JOIN_US_URL) return { status: 200, url, html: joinUsHtml }
      if (url === sahaj.JOB_ROLE_URL) return { status: 200, url, html: jobRoleHtml }

      throw new Error(`Unexpected Sahaj URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sahaj.HOMEPAGE_URL,
    sahaj.ABOUT_PAGE_URL,
    sahaj.JOIN_US_URL,
    sahaj.JOB_ROLE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sahaj sentinel fails closed when the verified first-party contract drifts or starts exposing company jobs', async () => {
  const sahaj = await loadModule()

  await assert.rejects(
    sahaj.createSahajScraper().run({
      fetchPage: async (url) => {
        if (url === sahaj.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('https://retail.sahaj.co.in/joinuspage', 'https://www.sahaj.co.in/careers'),
          }
        }

        throw new Error(`Unexpected Sahaj URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    sahaj.createSahajScraper().run({
      fetchPage: async (url) => {
        if (url === sahaj.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === sahaj.ABOUT_PAGE_URL) return { status: 200, url, html: aboutHtml }
        if (url === sahaj.JOIN_US_URL) return { status: 200, url, html: joinUsHtml }
        if (url === sahaj.JOB_ROLE_URL) return { status: 200, url, html: publicCompanyJobsHtml }

        throw new Error(`Unexpected Sahaj URL: ${url}`)
      },
    }),
    /public company jobs/i,
  )
})
