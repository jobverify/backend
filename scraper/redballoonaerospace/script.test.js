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
    <title>Red Balloon Aerospace — Near-Space Infrastructure</title>
  </head>
  <body>
    <main>
      <h1>RED BALLOON AEROSPACE</h1>
      <nav>
        <a href="/about/">About</a>
        <a href="/team/">Team</a>
        <a href="/jobs/">Jobs</a>
        <a href="/contact/">Contact</a>
      </nav>
      <p>AI - POWERED HIGH ALTITUDE STRATOSPHERIC PLATFORMS</p>
      <footer>TM 2026 RED BALLOON AEROSPACE PRIVATE LIMITED</footer>
    </main>
  </body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers — Red Balloon Aerospace</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Loading jobs...</p>
      <h2>Join Us</h2>
      <label for="track">Choose One</label>
      <select id="track" name="track">
        <option value="">Choose One</option>
      </select>
      <label for="resume">Resume/CV upload</label>
      <button type="button">Upload RESUME</button>
      <button type="submit">Submit</button>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact | Red Balloon Aerospace</title>
  </head>
  <body>
    <main>
      <h1>Contact</h1>
      <p>RED BALLOON AEROSPACE PRIVATE LIMITED</p>
      <p>Vijayawada, Andhra Pradesh</p>
    </main>
  </body>
</html>
`

const siteNotFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Site Not Found</title>
  </head>
  <body>
    <main>
      <h1>Site Not Found</h1>
      <p>You haven't deployed an app yet.</p>
      <p>You may have deployed an empty directory.</p>
      <p>This is a custom domain, but we haven't finished setting it up yet.</p>
    </main>
  </body>
</html>
`

test('Red Balloon scraper validates the verified homepage, jobs resume-form surface, and contact page', async () => {
  const redBalloon = await loadModule()
  assert.ok(redBalloon, 'Red Balloon scraper module should load')

  assert.equal(redBalloon.SOURCE, 'redballoonaerospace')
  assert.equal(redBalloon.COMPANY, 'Red Balloon Aerospace Private Limited')
  assert.equal(redBalloon.HOMEPAGE_URL, 'https://www.red-balloon.space/')
  assert.equal(redBalloon.JOBS_URL, 'https://www.red-balloon.space/jobs/')
  assert.equal(redBalloon.CONTACT_URL, 'https://www.red-balloon.space/contact/')
  assert.equal(redBalloon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(redBalloon.hasOfficialJobsSignal(jobsHtml), true)
  assert.equal(redBalloon.hasOfficialContactSignal(contactHtml), true)
  assert.equal(redBalloon.hasUnexpectedPublicJobsSignal(jobsHtml), false)
})

test('Red Balloon scraper returns no jobs while the verified first-party apply form remains the only public surface', async () => {
  const redBalloon = await loadModule()
  assert.ok(redBalloon, 'Red Balloon scraper module should load')

  const requestedUrls = []
  const jobs = await redBalloon.createRedBalloonAerospaceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === redBalloon.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === redBalloon.JOBS_URL) return { status: 200, url, html: jobsHtml }
      if (url === redBalloon.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    redBalloon.HOMEPAGE_URL,
    redBalloon.JOBS_URL,
    redBalloon.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Red Balloon scraper fails closed when the homepage, jobs form, or contact page drifts', async () => {
  const redBalloon = await loadModule()
  assert.ok(redBalloon, 'Red Balloon scraper module should load')

  await assert.rejects(
    redBalloon.createRedBalloonAerospaceScraper().run({
      fetchPage: async () => ({ status: 200, url: redBalloon.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    redBalloon.createRedBalloonAerospaceScraper().run({
      fetchPage: async (url) => {
        if (url === redBalloon.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === redBalloon.JOBS_URL) {
          return {
            status: 200,
            url,
            html: jobsHtml.replace(
              '</main>',
              '<a href="https://jobs.lever.co/redballoon/full-stack-engineer">Current Openings</a></main>',
            ),
          }
        }
        if (url === redBalloon.CONTACT_URL) return { status: 200, url, html: contactHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs page now exposes public jobs/i,
  )

  await assert.rejects(
    redBalloon.createRedBalloonAerospaceScraper().run({
      fetchPage: async (url) => {
        if (url === redBalloon.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === redBalloon.JOBS_URL) return { status: 200, url, html: jobsHtml }
        if (url === redBalloon.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder contact</h1></body></html>',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page/i,
  )
})

test('Red Balloon scraper returns no jobs when the verified first-party domain now serves the shared site-not-found shell', async () => {
  const redBalloon = await loadModule()
  assert.ok(redBalloon, 'Red Balloon scraper module should load')

  const jobs = await redBalloon.createRedBalloonAerospaceScraper().run({
    fetchPage: async (url) => ({ status: 404, url, html: siteNotFoundHtml }),
  })

  assert.deepEqual(jobs, [])
})
