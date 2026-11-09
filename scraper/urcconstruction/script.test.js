import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>URC Construction</title>
  </head>
  <body>
    <a href="Career.aspx">Careers</a>
    <a href="Contact-Us.aspx">Contact Us</a>
    <h2>About URC</h2>
    <p>URC Construction brings a wide range of capabilities to major infrastructure projects.</p>
    <p>Our integrated approach, adaptability, and dedication to quality over the past 6 decades has placed us at the forefront.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>URC Construction</title>
  </head>
  <body>
    <form action="./Career.aspx">
      <h1>Work With Us</h1>
      <p>We place a high value on internal growth and employee learning and development.</p>
      <label>Years of Work Experience</label>
      <label>Department</label>
      <div>Select Department</div>
      <div>Finance &amp; Accounts Department</div>
      <div>Enter 10 digit valid MobileNo.</div>
      <p>Please upload your resume as a .pdf, .doc, or .docx file only</p>
      <button type="submit">Submit</button>
    </form>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>The resource cannot be found.</title>
  </head>
  <body>
    <h1>The resource cannot be found.</h1>
    <p>HTTP 404. The resource you are looking for could have been removed.</p>
  </body>
</html>
`

test('URC Construction recognizes the current homepage, careers form, and branded 404 route', async () => {
  const urc = await loadModule()

  assert.equal(urc.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(urc.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    urc.isVerifiedMissingNonListingRoute({
      status: 404,
      url: 'https://www.urcindia.com/Employment.aspx',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('URC Construction returns no jobs while the careers page remains a first-party application form without public listings', async () => {
  const urc = await loadModule()

  const jobs = await urc.createUrcConstructionScraper().run({
    fetchPage: async (url) => {
      if (url === urc.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === urc.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (urc.NON_LISTING_ROUTE_URLS.includes(url)) return { status: 404, url, html: missingRouteHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
