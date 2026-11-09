import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange - AI-Powered Insurance Solutions | Automated Underwriting</title>
  </head>
  <body>
    <a href="https://nativeorange.ai/contact/">Book a Demo</a>
    <h1>AI-Powered Insurance Technology</h1>
    <p>The Future of Insurance AI</p>
    <p>Google Scale Partner</p>
    <p>GUIDEWIRE Vanguard Program</p>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Nativeorange | AI Insurance Technology Company | Nativeorange</title>
  </head>
  <body>
    <h1>About Us</h1>
    <p>Pioneering intelligent AI solutions to transform businesses and shape the digital future of technology.</p>
    <p>Our team brings experience from AWS, Google, and Microsoft.</p>
    <h2>Join Our Team</h2>
    <p>Nativeorange is always looking for software engineers that can leverage Agentic AI tools to help customers realize their vision.</p>
    <a href="https://nativeorange.ai/contact/">Apply Now</a>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Nativeorange | Schedule a Demo | Get Support | Nativeorange</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>Our team is ready to help you transform your business with cutting-edge technologies.</p>
    <p>Fill out the form below and our team will get back to you shortly.</p>
    <p>sales@nativeorange.ai</p>
    <p>+1 (925) 399-6005</p>
  </body>
</html>
`

const buildNoJobsRouteHtml = (routePath) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange - AI-Powered Insurance Solutions | Automated Underwriting</title>
  </head>
  <body>
    <a href="https://nativeorange.ai/contact/">Book a Demo</a>
    <a href="https://nativeorange.ai/${routePath}/#">Resources</a>
    <a href="https://nativeorange.ai/${routePath}/#">Privacy Policy</a>
    <a href="https://nativeorange.ai/${routePath}/#">Terms of Service</a>
    <h1>AI-Powered Insurance Technology</h1>
    <p>The Future of Insurance AI</p>
    <p>Google Scale Partner</p>
    <p>GUIDEWIRE Vanguard Program</p>
  </body>
</html>
`

const careersRouteHtml = buildNoJobsRouteHtml('careers')
const jobsRouteHtml = buildNoJobsRouteHtml('jobs')

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nativeorange Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/nativeorange/full-stack-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Native orange sentinel validates the verified homepage, about page, contact page, and marketing no-jobs routes', async () => {
  const nativeorange = await loadModule()
  assert.ok(nativeorange, 'Native orange scraper module should load')

  assert.equal(nativeorange.SOURCE, 'nativeorange')
  assert.equal(nativeorange.COMPANY, 'Native orange')
  assert.equal(nativeorange.VERIFIED_ON, '2026-08-13')
  assert.equal(nativeorange.HOMEPAGE_URL, 'https://nativeorange.ai/')
  assert.equal(nativeorange.ABOUT_URL, 'https://nativeorange.ai/about/')
  assert.equal(nativeorange.CONTACT_URL, 'https://nativeorange.ai/contact/')
  assert.equal(nativeorange.CAREERS_PAGE_URL, 'https://nativeorange.ai/careers/')
  assert.equal(nativeorange.JOBS_PAGE_URL, 'https://nativeorange.ai/jobs/')
  assert.deepEqual(nativeorange.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://nativeorange.ai/careers/',
    'https://nativeorange.ai/jobs/',
  ])
  assert.equal(nativeorange.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nativeorange.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(nativeorange.hasOfficialContactSignal(contactHtml), true)
  assert.equal(nativeorange.extractApplyHandoffUrl(aboutHtml), nativeorange.CONTACT_URL)
  assert.equal(nativeorange.hasPublicJobsSignal(homepageHtml, { currentUrl: nativeorange.HOMEPAGE_URL }), false)
  assert.equal(
    nativeorange.hasPublicJobsSignal(careersRouteHtml, { currentUrl: nativeorange.CAREERS_PAGE_URL }),
    false,
  )
  assert.equal(
    nativeorange.hasPublicJobsSignal(jobsRouteHtml, { currentUrl: nativeorange.JOBS_PAGE_URL }),
    false,
  )
  assert.equal(nativeorange.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Native orange run returns no jobs only while the verified marketing-shell handoff remains intact', async () => {
  const nativeorange = await loadModule()
  assert.ok(nativeorange, 'Native orange scraper module should load')

  const requestedUrls = []
  const jobs = await nativeorange.createNativeOrangeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === nativeorange.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === nativeorange.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === nativeorange.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === nativeorange.CAREERS_PAGE_URL) return { status: 200, url, html: careersRouteHtml }
      if (url === nativeorange.JOBS_PAGE_URL) return { status: 200, url, html: jobsRouteHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nativeorange.HOMEPAGE_URL,
    nativeorange.ABOUT_URL,
    nativeorange.CONTACT_URL,
    nativeorange.CAREERS_PAGE_URL,
    nativeorange.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Native orange fails closed when the homepage, about page, contact page, or marketing routes drift or expose public jobs', async () => {
  const nativeorange = await loadModule()
  assert.ok(nativeorange, 'Native orange scraper module should load')

  await assert.rejects(
    nativeorange.createNativeOrangeScraper().run({
      fetchPage: async () => ({ status: 200, url: nativeorange.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nativeorange.createNativeOrangeScraper().run({
      fetchPage: async (url) => {
        if (url === nativeorange.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === nativeorange.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutHtml.replace('/contact/', '/contact-sales/'),
          }
        }
        if (url === nativeorange.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === nativeorange.CAREERS_PAGE_URL) return { status: 200, url, html: careersRouteHtml }
        if (url === nativeorange.JOBS_PAGE_URL) return { status: 200, url, html: jobsRouteHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about page no longer hands candidates to the verified contact surface/i,
  )

  await assert.rejects(
    nativeorange.createNativeOrangeScraper().run({
      fetchPage: async (url) => {
        if (url === nativeorange.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === nativeorange.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === nativeorange.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === nativeorange.CAREERS_PAGE_URL) return { status: 200, url, html: publicJobsHtml }
        if (url === nativeorange.JOBS_PAGE_URL) return { status: 200, url, html: jobsRouteHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-jobs route no longer matches the known marketing shell/i,
  )
})
