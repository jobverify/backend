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
    <title>StoreKing - AI-Powered Digital Retail OS. Turning Kirana Stores into Bright Stores — Direct to Consumers</title>
  </head>
  <body>
    <nav>
      <a href="https://storeking.in/about">About us</a>
      <a href="https://storeking.in/contact">Contact us</a>
    </nav>
    <main>
      <p>AI-Powered Retail OS - For Stores. To Consumers.</p>
      <h1>ANY STORE. ONLINE.5 MINUTES.</h1>
      <p>Every Store Bright Store Direct to Consumers Online</p>
      <p>Localcube Commerce Pvt Ltd</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>StoreKing Retail OS - About Us | StoreKing</title>
  </head>
  <body>
    <main>
      <h1>We Understand Small-Town India Like No One Else</h1>
      <p>We are StoreKing - built for the backbone of India's retail economy. Since 2015, we've been solving real problems for real store owners.</p>
      <section>
        <h2>Be Part of the StoreKing Story</h2>
        <p>I Want to Join the Team</p>
        <a href="/contact">Explore Careers</a>
      </section>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>StoreKing Retail OS - Contact & Retailer Registration | StoreKing</title>
  </head>
  <body>
    <main>
      <h1>We'd Love to Hear from You</h1>
      <p>Localcube Commerce Pvt Ltd</p>
      <p>hello@storeking.in</p>
      <h2>How Can We Help You Today?</h2>
      <form>
        <label>You are ...</label>
        <select name="audience">
          <option>Existing Retailer</option>
          <option>Job Seeker</option>
          <option>General Inquiry / Others</option>
        </select>
      </form>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found | StoreKing</title>
    <link rel="canonical" href="https://storeking.in/" />
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <a href="https://storeking.in/">Back to Home</a>
    </main>
  </body>
</html>
`

test('StoreKing validates the verified homepage, about page, contact page, and missing careers routes', async () => {
  const storeking = await loadModule()
  assert.ok(storeking, 'StoreKing scraper module should load')

  assert.equal(storeking.SOURCE, 'storeking')
  assert.equal(storeking.COMPANY, 'StoreKing')
  assert.equal(storeking.HOMEPAGE_URL, 'https://storeking.in/')
  assert.equal(storeking.ABOUT_URL, 'https://storeking.in/about')
  assert.equal(storeking.CONTACT_URL, 'https://storeking.in/contact')
  assert.equal(storeking.CAREERS_URL, 'https://storeking.in/careers')
  assert.equal(storeking.CAREER_URL, 'https://storeking.in/career')
  assert.equal(storeking.JOBS_URL, 'https://storeking.in/jobs')
  assert.equal(storeking.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(storeking.hasAboutPageSignal(aboutHtml), true)
  assert.equal(storeking.hasContactPageSignal(contactHtml), true)
  assert.equal(storeking.hasVerifiedMissingRouteSignal(missingRouteHtml), true)
})

test('StoreKing run returns an empty list only while the verified official surface exposes no public careers board', async () => {
  const storeking = await loadModule()
  assert.ok(storeking, 'StoreKing scraper module should load')

  const requestedUrls = []
  const jobs = await storeking.createStoreKingScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === storeking.ABOUT_URL) return aboutHtml
      if (url === storeking.CONTACT_URL) return contactHtml
      if (url === storeking.CAREERS_URL) return missingRouteHtml
      if (url === storeking.CAREER_URL) return missingRouteHtml
      if (url === storeking.JOBS_URL) return missingRouteHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://storeking.in/about',
    'https://storeking.in/contact',
    'https://storeking.in/careers',
    'https://storeking.in/career',
    'https://storeking.in/jobs',
  ])
  assert.deepEqual(jobs, [])
})

test('StoreKing fails closed when the about page, contact page, or careers-route state drifts', async () => {
  const storeking = await loadModule()
  assert.ok(storeking, 'StoreKing scraper module should load')

  await assert.rejects(
    storeking.createStoreKingScraper().run({
      fetchText: async (url) => {
        if (url === storeking.ABOUT_URL) return '<html><body><h1>About</h1></body></html>'
        if (url === storeking.CONTACT_URL) return contactHtml
        return missingRouteHtml
      },
    }),
    /about page/i,
  )

  await assert.rejects(
    storeking.createStoreKingScraper().run({
      fetchText: async (url) => {
        if (url === storeking.ABOUT_URL) return aboutHtml
        if (url === storeking.CONTACT_URL) return '<html><body><h1>Contact</h1></body></html>'
        return missingRouteHtml
      },
    }),
    /contact page/i,
  )

  await assert.rejects(
    storeking.createStoreKingScraper().run({
      fetchText: async (url) => {
        if (url === storeking.ABOUT_URL) return aboutHtml
        if (url === storeking.CONTACT_URL) return contactHtml
        if (url === storeking.CAREERS_URL) {
          return '<html><body><h1>Careers</h1><a href="https://storeking.in/jobs/store-ops">View jobs</a></body></html>'
        }
        return missingRouteHtml
      },
    }),
    /careers routes/i,
  )
})
