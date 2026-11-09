import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-07T00:00:00.000Z'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>G10X | End-to-end digital and AI solutions</title>
    <meta
      name="description"
      content="Driven by customer obsession, G10X partners with enterprises to enhance experiences, strengthen performance, and deliver reliable, long-term business value."
    />
  </head>
  <body>
    <nav>
      <a href="/who-we-are">Who we are</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>End-to-end digital and AI solutions</h1>
      <p>Driven by customer obsession, we partner with enterprises to enhance experiences, strengthen performance, and deliver reliable, long-term business value.</p>
    </main>
    <footer>
      <div>Copyright © 2026 G10X | All rights reserved</div>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = homepageHtml.replace('Copyright Â© 2026 G10X', 'Copyright Â© <span id="year"></span> G10X')

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers</title>
    <meta
      name="description"
      content="Join G10X, a Great Place to Work Certified™ company. Work on AI and digital transformation projects with global brands. Explore opportunities."
    />
  </head>
  <body>
    <main>
      <p>If you're ready to grow your skills, shape what's next, and see your impact in action, join us.</p>
      <h2>Why G10X</h2>
      <h3>Grow with purpose</h3>
      <p>We're a Great Place to Work Certified™ organization where learning never stops.</p>
      <h3>Work with global brands</h3>
      <h2>Find your place at G10X</h2>
      <a href="/jobs">JOIN US</a>
    </main>
  </body>
</html>
`

const jobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Jobs</title>
    <meta
      name="description"
      content="Explore opportunities that challenge you, support you, and help you build a career that lasts."
    />
  </head>
  <body>
    <main>
      <h1>Your career starts here</h1>
      <h2>Our job offerings</h2>
      <p>0 job openings for you</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 - Page not found</title>
    <meta
      name="description"
      content="The page you are looking for doesn't exist or has been moved."
    />
  </head>
  <body>
    <div>404</div>
    <h1>Page not found</h1>
    <p>The page you are looking for doesn't exist or has been moved.</p>
  </body>
</html>
`

const loadG10XModule = async () => {
  try {
    return await import('../../scraper/g10x/script.js')
  } catch {
    assert.fail('Expected G10X scraper module at ../../scraper/g10x/script.js')
  }
}

test('G10X pins the verified October 3, 2026 zero-openings surface', async () => {
  const g10x = await loadG10XModule()

  assert.equal(g10x.SOURCE, 'g10x')
  assert.equal(g10x.COMPANY, 'G10X')
  assert.equal(g10x.HOMEPAGE_URL, 'https://www.g10x.com/')
  assert.equal(g10x.CAREERS_URL, 'https://www.g10x.com/careers')
  assert.equal(g10x.JOBS_URL, 'https://www.g10x.com/jobs')
  assert.equal(g10x.COMPANY_DOMAIN, 'g10x.com')
  assert.equal(g10x.VERIFIED_ON, '2026-10-03')
  assert.match(g10x.VERIFIED_SURFACE_SUMMARY, /October 3, 2026/i)
  assert.equal(g10x.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(g10x.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(g10x.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(g10x.hasOfficialJobsSignal(jobsHtml), true)
  assert.deepEqual(g10x.extractJobs(jobsHtml), [])
  assert.equal(
    g10x.isVerifiedMissingRoute({ status: 404, html: missingRouteHtml }),
    true,
  )
})

test('G10X verifies the first-party homepage, careers, jobs, and legacy missing routes before returning zero jobs', async () => {
  const g10x = await loadG10XModule()
  const requestedUrls = []

  const jobs = await g10x.createG10XScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === g10x.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === g10x.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === g10x.JOBS_URL) return { status: 200, url, html: jobsHtml }
      if (g10x.MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: missingRouteHtml }

      throw new Error(`Unexpected G10X URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    g10x.HOMEPAGE_URL,
    g10x.CAREERS_URL,
    g10x.JOBS_URL,
    ...g10x.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('G10X fails closed when the homepage year sentinel is removed or the jobs page gains openings', async () => {
  const g10x = await loadG10XModule()

  await assert.rejects(
    g10x.createG10XScraper().run({
      fetchPage: async (url) => {
        if (url === g10x.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml.replace('Copyright © 2026 G10X | All rights reserved', '') }
        }
        throw new Error(`Unexpected G10X URL: ${url}`)
      },
    }),
    /official homepage no longer matches/i,
  )

  await assert.rejects(
    g10x.createG10XScraper().run({
      fetchPage: async (url) => {
        if (url === g10x.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === g10x.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === g10x.JOBS_URL) {
          return {
            status: 200,
            url,
            html: jobsHtml.replace('0 job openings for you', '3 job openings for you'),
          }
        }
        if (g10x.MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: missingRouteHtml }

        throw new Error(`Unexpected G10X URL: ${url}`)
      },
    }),
    /public openings changed materially/i,
  )
})

test('G10X keeps zero listed roles when the only apply link is a verified general profile form', async () => {
  const g10x = await loadG10XModule()
  const generalApplyHtml = jobsHtml.replace('</main>', `
    <section><h2>Don't see a matching role?</h2>
      <p>We're always looking for exceptional talent. Share your profile for future opportunities.</p>
      <a id="proactively-apply-btn" href="/job-apply"><div>Share your profile</div></a>
    </section></main>`)

  assert.deepEqual(g10x.extractJobs(generalApplyHtml), [])
  assert.throws(
    () => g10x.extractJobs(generalApplyHtml.replace('id="proactively-apply-btn"', 'id="unexpected"')),
    /public openings changed materially/i,
  )
})
