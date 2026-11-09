import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Tesla</title>
  </head>
  <body>
    <h1>Build a World of Amazing Abundance</h1>
    <p>Search by Role or Department</p>
    <p>Explore Jobs</p>
    <p>Tesla participates in the E-Verify Program</p>
  </body>
</html>
`

const searchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build your Career at Tesla</h1>
    <p>Search by role or keyword</p>
    <p>Job Category</p>
    <p>Job Type</p>
    <p>Region</p>
    <p>Location</p>
    <p>India</p>
    <p>Learn More</p>
  </body>
</html>
`

const listingsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build your Career at Tesla</h1>
    <p>Consumer Engagement Manager</p>
    <p>Tesla Advisor - Mumbai</p>
    <p>Customer Support Supervisor</p>
    <p>Lead Generation Specialist</p>
    <p>Mumbai Suburban, Maharashtra</p>
  </body>
</html>
`

const detailHtml = ({ title, location, reqId }) => `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build your Career at Tesla</h1>
    <p>${title}</p>
    <p>Location | ${location}</p>
    <p>Req. ID | ${reqId}</p>
    <p>Job Type | Full-time</p>
    <a href="https://www.tesla.com/careers/search/job/apply/${reqId}">Apply</a>
  </body>
</html>
`

const accessDeniedHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Access Denied</title>
  </head>
  <body>
    <h1>Access Denied</h1>
    <p>You don't have permission to access "http&#58;&#47;&#47;www&#46;tesla&#46;com&#47;careers" on this server.</p>
    <p>Reference&#32;&#35;18&#46;c5543f17&#46;1786674653&#46;8dee6e09</p>
    <p>https&#58;&#47;&#47;errors&#46;edgesuite&#46;net&#47;18&#46;c5543f17&#46;1786674653&#46;8dee6e09</p>
  </body>
</html>
`

test('Tesla detects the encoded Akamai access-denied surface now returned on Friday, August 14, 2026', async () => {
  const tesla = await loadModule()

  assert.equal(tesla.hasAkamaiAccessDeniedSignal(accessDeniedHtml), true)
  assert.equal(tesla.isVerifiedEnvironmentBlockedPage({
    status: 403,
    url: tesla.CAREERS_URL,
    html: accessDeniedHtml,
  }), true)
})

test('Tesla run falls back to browser-backed fetches when direct requests return 403', async () => {
  const tesla = await loadModule()

  const requestedUrls = []
  const jobs = await tesla.createTeslaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(`direct:${url}`)
      return {
        status: 403,
        url,
        html: accessDeniedHtml,
      }
    },
    fetchBrowserPage: async (url) => {
      requestedUrls.push(`browser:${url}`)
      if (url === tesla.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === tesla.SEARCH_PAGE_URL) return { status: 200, url, html: searchHtml }
      if (url === tesla.INDIA_LISTINGS_PAGE_URL) return { status: 200, url, html: listingsHtml }
      if (url === tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL) {
        return {
          status: 200,
          url,
          html: detailHtml({
            title: 'Software Engineer, Full Stack, Tesla Cloud Platform',
            location: 'Pune, Maharashtra',
            reqId: '251983',
          }),
        }
      }
      if (url === tesla.SAMPLE_INDIA_SUPPORT_JOB_URL) {
        return {
          status: 200,
          url,
          html: detailHtml({
            title: 'Customer Support Specialist',
            location: 'Mumbai Suburban, Maharashtra',
            reqId: '237421',
          }),
        }
      }
      if (url === tesla.SAMPLE_INDIA_SERVICE_JOB_URL) {
        return {
          status: 200,
          url,
          html: detailHtml({
            title: 'Service Advisor',
            location: 'Mumbai Suburban, Maharashtra',
            reqId: '237425',
          }),
        }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    `direct:${tesla.CAREERS_URL}`,
    `browser:${tesla.CAREERS_URL}`,
    `direct:${tesla.SEARCH_PAGE_URL}`,
    `browser:${tesla.SEARCH_PAGE_URL}`,
    `direct:${tesla.INDIA_LISTINGS_PAGE_URL}`,
    `browser:${tesla.INDIA_LISTINGS_PAGE_URL}`,
    `direct:${tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL}`,
    `browser:${tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL}`,
    `direct:${tesla.SAMPLE_INDIA_SUPPORT_JOB_URL}`,
    `browser:${tesla.SAMPLE_INDIA_SUPPORT_JOB_URL}`,
    `direct:${tesla.SAMPLE_INDIA_SERVICE_JOB_URL}`,
    `browser:${tesla.SAMPLE_INDIA_SERVICE_JOB_URL}`,
  ])
})

test('Tesla returns [] when both direct and browser fetches land on the verified Akamai access-denied surface', async () => {
  const tesla = await loadModule()

  const jobs = await tesla.createTeslaScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: accessDeniedHtml,
    }),
    fetchBrowserPage: async (url) => ({
      status: 403,
      url,
      html: accessDeniedHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})
