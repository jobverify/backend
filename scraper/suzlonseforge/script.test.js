import assert from 'node:assert/strict'
import test from 'node:test'

const loadSuzlonSeForgeModule = async () => {
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
    <title>Full Stack Renewable Energy Partner | Suzlon Group</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/our-businesses">Our Businesses</a>
      <a href="/investors">Investors</a>
      <a href="/sustainability">Sustainability</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <section>
        <h2>Our Offerings</h2>
        <p>Find your place in our team of thinkers and innovators who are choosing the energy that moves the world forward every day.</p>
        <a href="/careers">Explore Careers</a>
      </section>
      <section>
        <h2>Latest news</h2>
      </section>
    </main>
    <footer>© 2026 Suzlon Energy Ltd. All Rights Reserved</footer>
  </body>
</html>
`

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Suzlon | Join India's Wind Energy Leader</title>
    <meta name="description" content="Build your career at Suzlon Energy - India's largest wind turbine manufacturer. Explore job opportunities, employee culture, benefits, and life at Suzlon's One Earth campus in Pune.">
  </head>
  <body>
    <nav>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>Your work can move the world forward</h1>
      <p>We are building renewable energy systems designed for the new world.</p>
      <section>
        <h2>Advancing people. Accelerating futures</h2>
        <p>Great Place To Work certified across India, Australia, Germany, and the Netherlands.</p>
      </section>
      <section>
        <h3>Equal opportunities</h3>
        <h3>Career advancement</h3>
        <h3>Women's Development</h3>
        <h3>1Learn</h3>
        <h3>Sectoral development</h3>
      </section>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Suzlon | Open Positions</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/suzlon/senior-engineer">Apply Now</a>
    </main>
  </body>
</html>
`

test('Suzlon-SE Forge sentinel recognizes the verified first-party Suzlon homepage and careers surface', async () => {
  const suzlonSeForge = await loadSuzlonSeForgeModule()
  assert.ok(suzlonSeForge, 'Expected Suzlon-SE Forge scraper module at ./script.js')

  assert.equal(suzlonSeForge.SOURCE, 'suzlonseforge')
  assert.equal(suzlonSeForge.COMPANY, 'Suzlon-SE Forge')
  assert.equal(suzlonSeForge.HOMEPAGE_URL, 'https://www.suzlon.com/')
  assert.equal(suzlonSeForge.CAREERS_URL, 'https://www.suzlon.com/careers/')
  assert.deepEqual(suzlonSeForge.CHECKED_ROUTE_URLS, [
    'https://www.suzlon.com/jobs/',
    'https://www.suzlon.com/career/',
  ])
  assert.equal(suzlonSeForge.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(suzlonSeForge.extractHomepageCareersUrl(officialHomepageHtml), 'https://www.suzlon.com/careers')
  assert.equal(suzlonSeForge.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(suzlonSeForge.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(suzlonSeForge.hasPublicJobsSignal(officialCareersHtml), false)
  assert.equal(suzlonSeForge.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Suzlon-SE Forge sentinel returns no jobs while the verified first-party careers surface has no public openings', async () => {
  const suzlonSeForge = await loadSuzlonSeForgeModule()
  assert.ok(suzlonSeForge, 'Expected Suzlon-SE Forge scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await suzlonSeForge.createSuzlonSeForgeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === suzlonSeForge.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (url === suzlonSeForge.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (suzlonSeForge.CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: '<html><body><h1>404 Not Found</h1></body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    suzlonSeForge.HOMEPAGE_URL,
    suzlonSeForge.CAREERS_URL,
    ...suzlonSeForge.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Suzlon-SE Forge sentinel fails closed when the verified careers surface drifts or starts exposing public jobs', async () => {
  const suzlonSeForge = await loadSuzlonSeForgeModule()
  assert.ok(suzlonSeForge, 'Expected Suzlon-SE Forge scraper module at ./script.js')

  await assert.rejects(
    suzlonSeForge.createSuzlonSeForgeScraper().run({
      fetchPage: async (url) => {
        if (url === suzlonSeForge.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body><main>Unexpected</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    suzlonSeForge.createSuzlonSeForgeScraper().run({
      fetchPage: async (url) => {
        if (url === suzlonSeForge.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === suzlonSeForge.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    suzlonSeForge.createSuzlonSeForgeScraper().run({
      fetchPage: async (url) => {
        if (url === suzlonSeForge.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === suzlonSeForge.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === suzlonSeForge.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><main>Jobs route unexpectedly exists</main></body></html>',
          }
        }

        if (url === suzlonSeForge.CHECKED_ROUTE_URLS[1]) {
          return {
            status: 404,
            url,
            html: '<html><body><h1>404 Not Found</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified missing route changed materially/i,
  )
})
