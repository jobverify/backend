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
      <title>Station - S</title>
    </head>
    <body>
      <header>
        <a href="/about.php">About Us</a>
        <a href="/programs.php">Programs</a>
        <a href="/facilities.php">Facilities</a>
        <a href="/platforms.php">Platforms</a>
        <a href="/contact.php">Contact Us</a>
        <a href="careers.php">Careers</a>
        <a href="careers.php">Apply Now</a>
      </header>
      <main>
        <h1>Station-S</h1>
        <p>T h e S t a r t u p S t u d i o</p>
        <p>Let's Get Your Venture Started in Sri City</p>
        <p>Station-S, Sri City, AP, India</p>
      </main>
      <footer>
        <p>© Copyright Station-S All Rights Reserved.</p>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Station - S</title>
    </head>
    <body>
      <header>
        <a href="careers.php">Careers</a>
        <a href="careers.php">Apply Now</a>
      </header>
      <main>
        <h2>Join Our Team</h2>
        <p>At Station-S, we're building the future of operations technology.</p>
        <p>All Categories Technical Product Management Digital Marketing Content & Creative Account Management</p>
        <p>Job Title Category Experience Location</p>
        <p>Station-S, Sri City, AP, India</p>
        <p>Phone: +91 88860 29585</p>
        <p>Email: info@station-s.org</p>
      </main>
    </body>
  </html>
`

test('Station-S validates the official homepage and empty first-party careers shell', async () => {
  const stations = await loadModule()
  assert.ok(stations, 'Station-S scraper module should load')

  assert.equal(stations.SOURCE, 'stations')
  assert.equal(stations.COMPANY, 'Station-S')
  assert.equal(stations.HOMEPAGE_URL, 'https://station-s.com/')
  assert.equal(stations.CAREERS_URL, 'https://station-s.com/careers.php')
  assert.equal(stations.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(stations.hasOfficialCareersShellSignal(careersHtml), true)
  assert.equal(stations.hasPublicJobsSignal(careersHtml), false)
})

test('Station-S returns no jobs only while the verified careers shell remains empty', async () => {
  const stations = await loadModule()
  assert.ok(stations, 'Station-S scraper module should load')

  const requestedUrls = []
  const jobs = await stations.createStationSScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === stations.HOMEPAGE_URL) return homepageHtml
      if (url === stations.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://station-s.com/',
    'https://station-s.com/careers.php',
  ])
  assert.deepEqual(jobs, [])
})

test('default Station-S fetches pass AbortSignal so live probes are bounded', async () => {
  const stations = await loadModule()
  assert.ok(stations, 'Station-S scraper module should load')

  const originalFetch = globalThis.fetch
  const requestedUrls = []
  const signals = []

  globalThis.fetch = async (url, options = {}) => {
    requestedUrls.push(String(url))
    signals.push(options.signal)

    if (url === stations.HOMEPAGE_URL) {
      return new Response(homepageHtml, { status: 200 })
    }

    if (url === stations.CAREERS_URL) {
      return new Response(careersHtml, { status: 200 })
    }

    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  try {
    const jobs = await stations.run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(requestedUrls, [
      stations.HOMEPAGE_URL,
      stations.CAREERS_URL,
    ])
    assert.equal(signals.length, requestedUrls.length)
    assert.ok(signals.every((signal) => signal instanceof AbortSignal))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Station-S fails closed when the homepage or careers shell changes materially', async () => {
  const stations = await loadModule()
  assert.ok(stations, 'Station-S scraper module should load')

  await assert.rejects(
    stations.createStationSScraper().run({
      fetchText: async (url) => {
        if (url === stations.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }
        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    stations.createStationSScraper().run({
      fetchText: async (url) => {
        if (url === stations.HOMEPAGE_URL) {
          return homepageHtml
        }
        return `
          <html>
            <body>
              <h2>Join Our Team</h2>
              <p>Job Title Category Experience Location</p>
              <a href="https://jobs.lever.co/stations">Apply now</a>
            </body>
          </html>
        `
      },
    }),
    /careers shell changed materially or now exposes public jobs/i,
  )
})
