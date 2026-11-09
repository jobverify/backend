import assert from 'node:assert/strict'
import test from 'node:test'

const loadOrangewoodLabsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Orangewood Labs - Democratizing Robots</title>
    <meta name="description" content="Orangewood Labs builds affordable robotic arms." />
    <script src="/_next/static/chunks/app/page-247ca194c0cda4ae.js" async=""></script>
  </head>
  <body>
    <main>
      <p>ROBOTS</p>
      <p>ARE HERE!</p>
      <a href="https://form.jotform.com/231726585212455">Pre-Order Now!</a>
      <h2>Democratizing Robots</h2>
      <p>Orangewood builds AI-powered robotic arms that are simple to operate.</p>
      <a href="https://calendly.com/orangewood-labs/demo">Book a Demo</a>
      <a href="/robogpt/">Read More</a>
      <h3>Join the Community</h3>
      <a href="https://mailchi.mp/orangewood.co/developer-community-signup">Know more</a>
      <p>hellorobot@orangewood.co</p>
      <p>Orangewood Labs Inc.</p>
      <p>2 Marina Blvd, Building B, 2nd floor, San Francisco, CA 94123</p>
      <p>Orangewood Research and Advancement Private Limited</p>
      <p>Second Floor, A-48, Sector-67, Noida, Gautam Buddha Nagar, Uttar Pradesh, 201301</p>
      <p>Contact Number: +91 79769 97082</p>
    </main>
  </body>
</html>
`

const verifiedRouteFallbackHtml = officialHomepageHtml

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Orangewood Labs Careers</title>
    <script src="/_next/static/chunks/app/page-careers.js" async=""></script>
  </head>
  <body>
    <main>
      <h1>Careers at Orangewood Labs</h1>
      <p>We are hiring across robotics engineering and operations.</p>
      <a href="https://jobs.lever.co/orangewoodlabs/software-engineer">View Job</a>
    </main>
  </body>
</html>
`

test('Orangewood Labs sentinel pins the verified homepage and first-party route-fallback shell', async () => {
  const orangewoodLabs = await loadOrangewoodLabsModule()
  assert.ok(orangewoodLabs, 'Expected scraper module at ./script.js')

  assert.equal(orangewoodLabs.SOURCE, 'orangewoodlabs')
  assert.equal(orangewoodLabs.COMPANY, 'Orangewood Labs')
  assert.equal(orangewoodLabs.HOMEPAGE_URL, 'https://orangewood.co/')
  assert.deepEqual(orangewoodLabs.CHECKED_ROUTE_URLS, [
    'https://orangewood.co/careers',
    'https://orangewood.co/career',
    'https://orangewood.co/jobs',
    'https://orangewood.co/join-us',
  ])
  assert.equal(orangewoodLabs.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(orangewoodLabs.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    orangewoodLabs.extractPageBundlePath(officialHomepageHtml),
    '/_next/static/chunks/app/page-247ca194c0cda4ae.js',
  )
  assert.equal(
    orangewoodLabs.isVerifiedRouteFallbackShell(
      verifiedRouteFallbackHtml,
      orangewoodLabs.extractPageBundlePath(officialHomepageHtml),
    ),
    true,
  )
})

test('Orangewood Labs sentinel returns no jobs only while checked routes still match the verified marketing shell', async () => {
  const orangewoodLabs = await loadOrangewoodLabsModule()
  assert.ok(orangewoodLabs, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await orangewoodLabs.createOrangewoodLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === orangewoodLabs.HOMEPAGE_URL) return officialHomepageHtml
      if (orangewoodLabs.CHECKED_ROUTE_URLS.includes(url)) return verifiedRouteFallbackHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    orangewoodLabs.HOMEPAGE_URL,
    ...orangewoodLabs.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Orangewood Labs sentinel fails closed when the homepage or a checked route starts exposing jobs', async () => {
  const orangewoodLabs = await loadOrangewoodLabsModule()
  assert.ok(orangewoodLabs, 'Expected scraper module at ./script.js')

  await assert.rejects(
    orangewoodLabs.createOrangewoodLabsScraper().run({
      fetchText: async (url) => {
        if (url === orangewoodLabs.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    orangewoodLabs.createOrangewoodLabsScraper().run({
      fetchText: async (url) => {
        if (url === orangewoodLabs.HOMEPAGE_URL) return officialHomepageHtml
        if (url === orangewoodLabs.CHECKED_ROUTE_URLS[0]) return publicJobsHtml
        if (orangewoodLabs.CHECKED_ROUTE_URLS.slice(1).includes(url)) return verifiedRouteFallbackHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
