import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Jupiter Meta scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Jupiter Meta</title>
      <meta property="og:title" content="Jupiter Meta" />
      <meta
        name="description"
        content="Our decentralised products create 2-way Data Monetisation and Data Security, putting privacy at the forefront through blockchain based DIDs."
      />
    </head>
    <body>
      <main>
        <h1>Jupiter Meta</h1>
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms-conditions">Terms &amp; Conditions</a>
      </main>
    </body>
  </html>
`

const contactPageHtml = `
  <html>
    <head>
      <title>Jupiter Meta</title>
    </head>
    <body>
      <h1>Contact Us</h1>
      <p>Enter your email address and our team will get back to you.</p>
    </body>
  </html>
`

const missingRoutePage = {
  status: 404,
  url: 'https://jupitermeta.io/careers',
  html: '',
  errorMessage: '',
}

test('Jupiter Meta sentinel pins the verified first-party surface from 2026-07-13', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'jupitermeta')
  assert.equal(scraper.COMPANY, 'Jupiter Meta')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://jupitermeta.io/')
  assert.equal(scraper.CONTACT_URL, 'https://jupitermeta.io/contact')
  assert.deepEqual(scraper.CAREER_PATHS, [
    'https://jupitermeta.io/careers',
    'https://jupitermeta.io/career',
    'https://jupitermeta.io/jobs',
    'https://jupitermeta.io/join-us',
    'https://jupitermeta.io/work-with-us',
  ])

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasHomepageCareersSignal(homepageHtml), false)
  assert.equal(scraper.hasOfficialContactSignal(contactPageHtml), true)
  assert.equal(scraper.hasMissingCareersRouteSignal(missingRoutePage), true)
})

test('Jupiter Meta sentinel returns [] only while the verified homepage stays job-free and the checked careers routes stay 404', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createJupiterMetaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml, errorMessage: '' }
      }

      if (url === scraper.CONTACT_URL) {
        return { status: 200, url, html: contactPageHtml, errorMessage: '' }
      }

      if (scraper.CAREER_PATHS.includes(url)) {
        return { status: 404, url, html: '', errorMessage: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CONTACT_URL,
    ...scraper.CAREER_PATHS,
  ])
  assert.deepEqual(jobs, [])
})

test('Jupiter Meta sentinel fails closed when the homepage starts advertising jobs', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createJupiterMetaScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<section><h2>Careers</h2><a href="/careers">Join us</a></section>`,
            errorMessage: '',
          }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactPageHtml, errorMessage: '' }
        }

        return { status: 404, url, html: '', errorMessage: '' }
      },
    }),
    /homepage now shows a public careers signal/i,
  )
})

test('Jupiter Meta sentinel fails closed when any checked careers route stops being a verified 404', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createJupiterMetaScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml, errorMessage: '' }
        }

        if (url === scraper.CONTACT_URL) {
          return { status: 200, url, html: contactPageHtml, errorMessage: '' }
        }

        if (url === scraper.CAREER_PATHS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/apply">Apply</a></body></html>',
            errorMessage: '',
          }
        }

        return { status: 404, url, html: '', errorMessage: '' }
      },
    }),
    /public careers surface changed/i,
  )
})
