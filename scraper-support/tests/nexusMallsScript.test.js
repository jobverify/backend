import assert from 'node:assert/strict'
import test from 'node:test'

const loadNexusMallsModule = async () => {
  try {
    return await import('../../scraper/nexusmalls/script.js')
  } catch {
    assert.fail('Expected Nexus Malls scraper module at ../../scraper/nexusmalls/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nexus Select Trust | Listed Real Estate Investment Trust (REIT)</title>
  </head>
  <body>
    <nav>
      <a href="/about-nexus">About Nexus</a>
      <a href="/portfolio">Portfolio</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>India's first publicly listed retail Real Estate Investment Trust (REIT)</h1>
      <section>
        <h2>About Us</h2>
        <p>
          Nexus has emerged to be biggest retail real estate platform in India, ever since its
          penetration in the dynamic and competitive market in 2016.
        </p>
      </section>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nexus</title>
  </head>
  <body>
    <main>
      <h1>404 Page Not Found</h1>
      <p>Back to Home</p>
    </main>
  </body>
</html>
`

const currentCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at nexus</title>
  </head>
  <body>
    <h1>Where Your Potential Meets Purpose</h1>
    <p>Join our Team</p>
    <p>Our Featured Jobs</p>
    <p>Be a part of Nexus</p>
    <p>Find Jobs</p>
    <a href="mailto:careers@nexusmalls.com">careers@nexusmalls.com</a>
    <div class="job-card">
      <h2 class="job-title">Assistant Manager - Finance &amp; Accounts</h2>
      <p class="job-desc">Own mall finance operations.</p>
      <span class="tag">Nexus Hyderabad</span>
      <span class="tag">Full-time</span>
      <span class="tag">Finance &amp; Accounts</span>
      <span class="tag">4-6 years</span>
      <a href="https://www.nexusselecttrust.com/career/job-details/assistant-manager-finance" class="btn-view-details">View Details</a>
    </div>
    <div class="job-card">
      <h2 class="job-title">Executive - Food Court Operations</h2>
      <p class="job-desc">Manage food court operations.</p>
      <span class="tag">Nexus Whitefield, Bengaluru</span>
      <span class="tag">Full-time</span>
      <span class="tag">Operations</span>
      <span class="tag">2-4 years</span>
      <a href="https://www.nexusselecttrust.com/career/job-details/executive-food-court" class="btn-view-details">View Details</a>
    </div>
  </body>
</html>
`

test('Nexus Malls scraper validates the official public site and verified missing careers routes', async () => {
  const nexus = await loadNexusMallsModule()

  assert.equal(nexus.HOMEPAGE_URL, 'https://www.nexusselecttrust.com/')
  assert.equal(nexus.CAREERS_URL, 'https://www.nexusselecttrust.com/careers')
  assert.equal(nexus.JOBS_URL, 'https://www.nexusselecttrust.com/jobs')
  assert.equal(nexus.hasOfficialHomepageSignal(homepageHtml), true)
  assert.deepEqual(nexus.extractCareerLikeLinks(homepageHtml), [])
  assert.equal(
    nexus.hasMissingRouteSignal({ status: 404, html: missingRouteHtml }),
    true,
  )
})

test('Nexus Malls scraper returns no jobs when the official public site exposes no careers board', async () => {
  const nexus = await loadNexusMallsModule()
  const requestedUrls = []

  const jobs = await nexus.createNexusMallsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nexus.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === nexus.CAREERS_URL || url === nexus.JOBS_URL) {
        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      }

      throw new Error(`Unexpected Nexus Malls fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nexus.HOMEPAGE_URL,
    nexus.CAREERS_URL,
    nexus.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Nexus Malls scraper returns the current first-party career cards', async () => {
  const nexus = await loadNexusMallsModule()

  assert.equal(nexus.hasOfficialCareerPageSignal(currentCareerHtml), true)

  const jobs = await nexus.createNexusMallsScraper().run({
    fetchPage: async (url) => {
      if (url === nexus.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml.replace(
            '<a href="/contact-us">Contact Us</a>',
            '<a href="https://www.nexusselecttrust.com/career">Careers</a>',
          ),
        }
      }

      if (url === 'https://www.nexusselecttrust.com/career') {
        return {
          status: 200,
          url,
          html: currentCareerHtml,
        }
      }

      throw new Error(`Unexpected Nexus Malls fixture URL: ${url}`)
    },
  })

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Assistant Manager - Finance & Accounts',
      'Executive - Food Court Operations',
    ],
  )
})

test('Nexus Malls scraper fails closed when the official surface changes', async () => {
  const nexus = await loadNexusMallsModule()

  await assert.rejects(
    nexus.createNexusMallsScraper().run({
      fetchPage: async (url) => {
        if (url === nexus.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '<a href="/contact-us">Contact Us</a>',
              '<a href="/careers">Careers</a>',
            ),
          }
        }

        if (url === nexus.CAREERS_URL || url === nexus.JOBS_URL) {
          return {
            status: 404,
            url,
            html: missingRouteHtml,
          }
        }

        throw new Error(`Unexpected Nexus Malls fixture URL: ${url}`)
      },
    }),
    /public careers surface/i,
  )

  await assert.rejects(
    nexus.createNexusMallsScraper().run({
      fetchPage: async (url) => {
        if (url === nexus.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        return {
          status: 200,
          url,
          html: '<html><body><main><h1>Careers</h1></main></body></html>',
        }
      },
    }),
    /verified missing careers routes changed/i,
  )
})
