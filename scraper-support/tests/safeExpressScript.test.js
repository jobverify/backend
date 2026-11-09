import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home-SAFE EXPRESS</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about.html">About</a>
      <a href="/services.html">Services</a>
      <a href="/contact.html">Contact</a>
      <a href="/track.html">Track your Cargo</a>
    </nav>
    <h1>SAFE EXPRESS</h1>
    <h2>Your Lightning Fast Delivery Partner</h2>
    <p>We are a privately owned company that provides top-notch customs clearing and forwarding solutions.</p>
    <p>As a trusted and licensed custom house agent, Safe Express discharges all duties and services related to Sea custom clearing of consignments with utmost care and minimum delays.</p>
    <p>To provide the best-in-class experience to our customer with total logistics solution that are timely, innovative, effective and efficient.</p>
    <p>Phone: (+91) 033-40106890</p>
    <p>Email: info@safeexpress.in</p>
    <footer>© Copyright SAFE EXPRESS. All Rights Reserved</footer>
  </body>
</html>
`

const CONTACT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact-SafeExpress</title>
  </head>
  <body>
    <h1>Contact</h1>
    <p>We was chosen by a lot of companies needing our Expert,Experience & Excellence Logistics Solutions.</p>
    <p>(+91) 033-40106890</p>
    <p>3,B.N SARKAR SARANI (FORMERLY: CHOWRINGHEE APPROACH) "BASU HOUSE" 2ND FLOOR, KOLKATA – 700072</p>
    <p>info@safeexpress.in</p>
    <footer>© Copyright SAFE EXPRESS. All Rights Reserved</footer>
  </body>
</html>
`

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home-SAFE EXPRESS</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about.html">About</a>
      <a href="/services.html">Services</a>
      <a href="/carriers.html">Carriers</a>
      <span>Drop Down</span>
      <span>Deep Drop Down</span>
      <a href="/contact.html">Contact</a>
      <a href="/track.html">Track your Cargo</a>
    </nav>
    <h1>SAFE EXPRESS</h1>
    <h2>Your Lightning Fast Delivery Partner</h2>
    <p>We offer a range of value added services, such as free consulting to clients regarding a variety of customs processes and procedures and are guided by stringent value principles apply best practices in our daily operations.</p>
    <p>We are a privately owned company that provides top-notch customs clearing and forwarding solutions.</p>
    <p>Phone: (+91) 033-40106890</p>
    <p>Email: info@safeexpress.in</p>
  </body>
</html>
`

const PAGE_WITH_PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - SAFE EXPRESS</title>
  </head>
  <body>
    <h1>Careers at SAFE EXPRESS</h1>
    <h2>Current Openings</h2>
    <a href="/apply">Apply now</a>
    <p>Send your resume for Logistics Operations Executive.</p>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/safeexpress/script.js')
  } catch {
    assert.fail('Expected SafeExpress scraper module at ../../scraper/safeexpress/script.js')
  }
}

test('SafeExpress sentinel helpers stay pinned to the verified official homepage and contact page', async () => {
  const safeExpress = await loadScriptModule()

  assert.equal(safeExpress.SOURCE, 'safeexpress')
  assert.equal(safeExpress.COMPANY, 'SafeExpress')
  assert.equal(safeExpress.OFFICIAL_BRAND_NAME, 'SAFE EXPRESS')
  assert.equal(safeExpress.VERIFIED_ON, '2026-07-17')
  assert.equal(safeExpress.HOMEPAGE_URL, 'https://www.safeexpress.in/')
  assert.equal(safeExpress.CONTACT_URL, 'https://www.safeexpress.in/contact.html')
  assert.equal(safeExpress.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(safeExpress.hasOfficialContactSignal(CONTACT_PAGE_HTML), true)
  assert.equal(safeExpress.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(safeExpress.hasPublicJobsSignal(CONTACT_PAGE_HTML), false)
  assert.equal(safeExpress.hasPublicJobsSignal(PAGE_WITH_PUBLIC_JOBS_HTML), true)
})

test('SafeExpress accepts the current homepage navigation with the carriers menu item', async () => {
  const safeExpress = await loadScriptModule()

  assert.equal(safeExpress.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
})

test('SafeExpress returns [] only while the official exact-name site remains informational and exposes no public jobs surface', async () => {
  const safeExpress = await loadScriptModule()
  const requestedUrls = []

  const jobs = await safeExpress.createSafeExpressScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === safeExpress.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === safeExpress.CONTACT_URL) return CONTACT_PAGE_HTML
      throw new Error(`Unexpected SafeExpress URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    safeExpress.HOMEPAGE_URL,
    safeExpress.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SafeExpress fails closed when the verified informational surface drifts or starts exposing public jobs', async () => {
  const safeExpress = await loadScriptModule()

  await assert.rejects(
    safeExpress.createSafeExpressScraper().run({
      fetchText: async (url) => {
        if (url === safeExpress.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        return CONTACT_PAGE_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    safeExpress.createSafeExpressScraper().run({
      fetchText: async (url) => {
        if (url === safeExpress.HOMEPAGE_URL) return HOMEPAGE_HTML
        return '<html><body><h1>Unexpected</h1></body></html>'
      },
    }),
    /verified contact page/i,
  )

  await assert.rejects(
    safeExpress.createSafeExpressScraper().run({
      fetchText: async () => PAGE_WITH_PUBLIC_JOBS_HTML,
    }),
    /surface now appears to expose public jobs/i,
  )
})
