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
      <title>Syntacticlogic Technology Services</title>
      <meta name="description" content="Syntacticlogic Technology Services" />
    </head>
    <body>
      <header>
        <a href="https://syntacticlogic.com/careers/">Careers</a>
        <a href="https://syntacticlogic.com/contact-us/">Contact Us</a>
      </header>
      <main>
        <h1>Syntacticlogic Technology Services</h1>
        <p>Engineering digital outcomes with cloud, data, and product delivery.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers - Syntacticlogic Technology Services</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>Current openings</h2>
        <p>Please share us your profile to careers@syntacticlogic.com.</p>
        <p>We will get in touch when a suitable role opens up.</p>
      </main>
    </body>
  </html>
`

const redesignedHomepageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Home - Syntacticlogic Technology Services</title>
      <link rel="canonical" href="https://syntacticlogic.com/" />
    </head>
    <body>
      <main>
        <h1>Reinventing the Future through Technology.</h1>
        <p>We help disruptive companies change the world.</p>
      </main>
    </body>
  </html>
`

test('Syntacticlogic validates the official homepage and email-only careers shell', async () => {
  const syntacticlogic = await loadModule()
  assert.ok(syntacticlogic, 'Syntacticlogic scraper module should load')

  assert.equal(syntacticlogic.SOURCE, 'syntacticlogic')
  assert.equal(syntacticlogic.COMPANY, 'Syntacticlogic Technology')
  assert.equal(syntacticlogic.HOMEPAGE_URL, 'https://syntacticlogic.com/')
  assert.equal(syntacticlogic.CAREERS_URL, 'https://syntacticlogic.com/careers/')
  assert.equal(syntacticlogic.REQUEST_HEADERS['Accept-Language'], 'en-US,en;q=0.9')
  assert.equal(syntacticlogic.REQUEST_HEADERS['Sec-Fetch-Mode'], 'navigate')
  assert.equal(syntacticlogic.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(syntacticlogic.hasOfficialHomepageSignal(redesignedHomepageHtml), true)
  assert.equal(syntacticlogic.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(syntacticlogic.hasPublicJobsSignal(careersHtml), false)
  assert.equal(syntacticlogic.hasFirstPartyJobListingLink(careersHtml), false)
})

test('Syntacticlogic returns no jobs only while the verified non-listing careers contract remains intact', async () => {
  const syntacticlogic = await loadModule()
  assert.ok(syntacticlogic, 'Syntacticlogic scraper module should load')

  const requestedUrls = []
  const jobs = await syntacticlogic.createSyntacticlogicScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === syntacticlogic.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }
      if (url === syntacticlogic.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://syntacticlogic.com/',
    'https://syntacticlogic.com/careers/',
  ])
  assert.deepEqual(jobs, [])
})

test('Syntacticlogic fails closed when the homepage or careers shell changes materially', async () => {
  const syntacticlogic = await loadModule()
  assert.ok(syntacticlogic, 'Syntacticlogic scraper module should load')

  await assert.rejects(
    syntacticlogic.createSyntacticlogicScraper().run({
      fetchPage: async (url) => {
        if (url === syntacticlogic.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    syntacticlogic.createSyntacticlogicScraper().run({
      fetchPage: async (url) => {
        if (url === syntacticlogic.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        return {
          status: 200,
          url,
          html: `
            <html>
              <body>
                <h2>Current openings</h2>
                <a href="https://boards.greenhouse.io/syntacticlogic">Apply now</a>
              </body>
            </html>
          `,
        }
      },
    }),
    /careers page changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    syntacticlogic.createSyntacticlogicScraper().run({
      fetchPage: async (url) => {
        if (url === syntacticlogic.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        return {
          status: 200,
          url,
          html: `
            <html>
              <body>
                <h2>Current openings</h2>
                <p>Please share us your profile to careers@syntacticlogic.com.</p>
                <a href="https://syntacticlogic.com/careers/senior-platform-engineer">Senior Platform Engineer</a>
              </body>
            </html>
          `,
        }
      },
    }),
    /careers page changed materially or now exposes public jobs/i,
  )
})
