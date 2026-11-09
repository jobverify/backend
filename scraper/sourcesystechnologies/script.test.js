import assert from 'node:assert/strict'
import test from 'node:test'

const loadSourcesysModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Sourcesys – Global Software, Engineering & Workforce Solutions</title>
  </head>
  <body>
    <main>
      <h1>Empowering Businesses to Innovate, Transform, and Scale Globally</h1>
      <p>End-to-end software, engineering, and workforce solutions for enterprises, electronics, and engineering organizations worldwide.</p>
      <section>
        <h2>About Sourcesys</h2>
        <p>Sourcesys is a global technology and engineering company delivering innovative software, embedded systems, and workforce solutions.</p>
      </section>
      <nav>
        <a href="/about">About Us</a>
        <a href="/blog">Blog</a>
        <a href="/careers">Careers</a>
        <a href="/contact">Contact Us</a>
      </nav>
    </main>
  </body>
</html>
`

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Sourcesys | Join Our Global Tech & Engineering Team</title>
    <meta
      name="description"
      content="Explore career opportunities at Sourcesys. Join our global software, electronics, and engineering teams to innovate, grow, and make an impact."
    >
  </head>
  <body>
    <main>
      <h1>Join Us. Innovate. Make an Impact.</h1>
      <p>At Sourcesys, we believe people drive innovation. Our mission is to build cutting-edge software, engineering, and AI solutions for enterprise, electronics, and engineering sectors worldwide.</p>
      <p>Whether you're a software developer, engineer, data scientist, or HR specialist, Sourcesys offers the platform, tools, and culture to grow your career while making a real impact.</p>
      <section>
        <h2>Why Work at Sourcesys</h2>
        <h5>Innovation-Driven Environment</h5>
        <p>Work on AI, cloud, IoT, embedded systems, and advanced engineering projects.</p>
        <h5>Global Opportunities</h5>
        <p>Collaborate with teams and clients across India, Europe, North America, and beyond.</p>
      </section>
      <section>
        <h2>Benefits of Working at Sourcesys</h2>
        <ul>
          <li>Competitive compensation and performance bonuses</li>
          <li>Health insurance and wellness programs</li>
          <li>Learning and certification support</li>
          <li>Flexible work hours and hybrid options</li>
          <li>Employee referral programs and recognition awards</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Sourcesys Current Openings</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <article class="job-card">
        <h2>Frontend Developer</h2>
        <p>Chennai, India</p>
        <a href="/careers/frontend-developer">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

test('Sourcesys sentinel recognizes the verified official homepage, careers page, and checked no-jobs routes', async () => {
  const sourcesys = await loadSourcesysModule()
  assert.ok(sourcesys, 'Expected Sourcesys scraper module at ./script.js')

  assert.equal(sourcesys.SOURCE, 'sourcesystechnologies')
  assert.equal(sourcesys.COMPANY, 'Sourcesys Technologies')
  assert.equal(sourcesys.HOMEPAGE_URL, 'https://www.sourcesys.co/')
  assert.equal(sourcesys.CAREERS_URL, 'https://www.sourcesys.co/careers')
  assert.deepEqual(sourcesys.CHECKED_NO_JOBS_ROUTE_URLS, [
    'https://www.sourcesys.co/career',
    'https://www.sourcesys.co/jobs',
    'https://www.sourcesys.co/current-openings',
    'https://www.sourcesys.co/join-us',
  ])
  assert.equal(sourcesys.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(sourcesys.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(sourcesys.pageExposesPublicJobListings(officialHomepageHtml), false)
  assert.equal(sourcesys.pageExposesPublicJobListings(officialCareersHtml), false)
  assert.equal(
    sourcesys.isVerifiedMissingJobsRoute({
      status: 404,
      url: 'https://www.sourcesys.co/jobs',
      html: '<html><title>404</title></html>',
    }),
    true,
  )
})

test('Sourcesys sentinel returns no jobs while the verified official first-party surface has no public openings', async () => {
  const sourcesys = await loadSourcesysModule()
  assert.ok(sourcesys, 'Expected Sourcesys scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await sourcesys.createSourcesysTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sourcesys.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (url === sourcesys.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (sourcesys.CHECKED_NO_JOBS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: '<html><title>404</title><body>Not Found</body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sourcesys.HOMEPAGE_URL,
    sourcesys.CAREERS_URL,
    ...sourcesys.CHECKED_NO_JOBS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Sourcesys sentinel fails closed when the official surface drifts or starts exposing public jobs', async () => {
  const sourcesys = await loadSourcesysModule()
  assert.ok(sourcesys, 'Expected Sourcesys scraper module at ./script.js')

  await assert.rejects(
    sourcesys.createSourcesysTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === sourcesys.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body><main>Coming soon</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    sourcesys.createSourcesysTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === sourcesys.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === sourcesys.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers surface now exposes public job listings/i,
  )

  await assert.rejects(
    sourcesys.createSourcesysTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === sourcesys.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === sourcesys.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === sourcesys.CHECKED_NO_JOBS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (sourcesys.CHECKED_NO_JOBS_ROUTE_URLS.slice(1).includes(url)) {
          return {
            status: 404,
            url,
            html: '<html><title>404</title><body>Not Found</body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked alternate first-party jobs route changed materially/i,
  )
})
