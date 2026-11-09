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
    <title>Leading Contracting Company and Rock Supplier in UAE</title>
  </head>
  <body>
    <main>
      <h1>"Building a Strong Foundation for the Future"</h1>
      <nav>
        <a href="/careers/">Careers</a>
        <a href="/contact-us/">Contact Us</a>
      </nav>
      <h2>About Royal Atlas</h2>
      <p>Founded in 2010, Royal Atlas General Contracting is a leading construction and infrastructure company based in Abu Dhabi, UAE.</p>
      <p>Expertise in Earthwork, Aggregates Supply & Heavy Equipment Rentals.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Royal Atlas</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>At Royal Atlas General Contracting, we believe that our people are our greatest asset.</p>
      <p>Please send your resume and a cover letter to
        <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="5c342e1c2e33253d30713d28303d2f723f3331">[email&#160;protected]</a>.
      </p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Royal Atlas</title>
  </head>
  <body>
    <main>
      <h1>Write to Us</h1>
      <p>Office No 604, Regal Tower</p>
      <p>Tel: +9714 883 8384</p>
      <p>Email:
        <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="40292e262f00322f39212c6d21342c21336e232f2d">[email&#160;protected]</a>
      </p>
      <p>Jebel Ali Freezone - Dubai</p>
    </main>
  </body>
</html>
`

test('Royal Atlas scraper validates the verified homepage, email-only careers page, and contact page', async () => {
  const royalAtlas = await loadModule()
  assert.ok(royalAtlas, 'Royal Atlas scraper module should load')

  assert.equal(royalAtlas.SOURCE, 'royalatlas')
  assert.equal(royalAtlas.COMPANY, 'Royal Atlas')
  assert.equal(royalAtlas.HOMEPAGE_URL, 'https://royal-atlas.com/')
  assert.equal(royalAtlas.CAREERS_URL, 'https://royal-atlas.com/careers/')
  assert.equal(royalAtlas.CONTACT_URL, 'https://royal-atlas.com/contact-us/')
  assert.equal(royalAtlas.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(royalAtlas.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(royalAtlas.hasOfficialContactSignal(contactHtml), true)
  assert.equal(royalAtlas.extractApplicationEmail(careersHtml), 'hr@royal-atlas.com')
  assert.equal(royalAtlas.extractApplicationEmail(contactHtml), 'info@royal-atlas.com')
  assert.equal(royalAtlas.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Royal Atlas scraper returns no jobs while the verified careers surface remains email-only', async () => {
  const royalAtlas = await loadModule()
  assert.ok(royalAtlas, 'Royal Atlas scraper module should load')

  const requestedUrls = []
  const jobs = await royalAtlas.createRoyalAtlasScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === royalAtlas.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === royalAtlas.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === royalAtlas.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    royalAtlas.HOMEPAGE_URL,
    royalAtlas.CAREERS_URL,
    royalAtlas.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Royal Atlas scraper fails closed when the homepage, careers page, or contact page drifts', async () => {
  const royalAtlas = await loadModule()
  assert.ok(royalAtlas, 'Royal Atlas scraper module should load')

  await assert.rejects(
    royalAtlas.createRoyalAtlasScraper().run({
      fetchPage: async () => ({ status: 200, url: royalAtlas.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    royalAtlas.createRoyalAtlasScraper().run({
      fetchPage: async (url) => {
        if (url === royalAtlas.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === royalAtlas.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</main>',
              '<a href="https://jobs.lever.co/royalatlas/site-engineer">Current Openings</a></main>',
            ),
          }
        }
        if (url === royalAtlas.CONTACT_URL) return { status: 200, url, html: contactHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now exposes public jobs/i,
  )

  await assert.rejects(
    royalAtlas.createRoyalAtlasScraper().run({
      fetchPage: async (url) => {
        if (url === royalAtlas.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === royalAtlas.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === royalAtlas.CONTACT_URL) {
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
