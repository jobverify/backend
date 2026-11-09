import assert from 'node:assert/strict'
import test from 'node:test'

const REDIRECTED_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About | Techspian</title>
  </head>
  <body>
    <main>
      <h1>We were AI-native before it was a slide.</h1>
      <p>The people behind the work.</p>
      <p>The travel and hospitality technology firm that advises, builds, and operates the systems that move travel businesses from the boardroom to production.</p>
      <a href="mailto:marketing@techspian.com">marketing@techspian.com</a>
    </main>
  </body>
</html>
`

const CONTACT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact | Techspian</title>
  </head>
  <body>
    <main>
      <p>Strategy and advisory</p>
      <a href="/contact">Book a strategy call</a>
      <a href="mailto:marketing@techspian.com">marketing@techspian.com</a>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Techspian</title>
  </head>
  <body>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Software Engineer"}
    </script>
    <a href="https://boards.greenhouse.io/techspian/jobs/123">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techspian/script.js')
  } catch {
    assert.fail('Expected Techspian scraper module at ../../scraper/techspian/script.js')
  }
}

test('Techspian sentinel helpers stay pinned to the verified legacy careers redirect and contact pages', async () => {
  const techspian = await loadScriptModule()

  assert.equal(techspian.SOURCE, 'techspian')
  assert.equal(techspian.COMPANY, 'Techspian')
  assert.equal(techspian.OFFICIAL_BRAND_NAME, 'Techspian')
  assert.equal(techspian.VERIFIED_ON, '2026-08-05')
  assert.equal(techspian.HOMEPAGE_URL, 'https://techspian.com/')
  assert.equal(techspian.CAREERS_URL, 'https://www.techspian.com/techspian-careers/')
  assert.equal(techspian.REDIRECTED_CAREERS_URL, 'https://techspian.com/about')
  assert.equal(techspian.CONTACT_URL, 'https://techspian.com/contact')
  assert.equal(techspian.CONTACT_EMAIL, 'marketing@techspian.com')
  assert.equal(techspian.hasRedirectedAboutPageSignal(REDIRECTED_ABOUT_HTML), true)
  assert.equal(techspian.hasContactPageSignal(CONTACT_HTML), true)
  assert.deepEqual(techspian.extractTrustedPublicJobLinks(REDIRECTED_ABOUT_HTML), [])
  assert.equal(techspian.pageExposesPublicJobListings(REDIRECTED_ABOUT_HTML), false)
  assert.equal(techspian.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Techspian returns [] for the verified redirect-plus-contact surface and fails closed if public jobs appear', async () => {
  const techspian = await loadScriptModule()
  const requestedUrls = []

  const jobs = await techspian.createTechspianScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === techspian.CAREERS_URL) {
        return {
          status: 200,
          url: techspian.REDIRECTED_CAREERS_URL,
          html: REDIRECTED_ABOUT_HTML,
        }
      }

      if (url === techspian.CONTACT_URL) {
        return {
          status: 200,
          url: techspian.CONTACT_URL,
          html: CONTACT_HTML,
        }
      }

      throw new Error(`Unexpected Techspian URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    techspian.CAREERS_URL,
    techspian.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    techspian.createTechspianScraper().run({
      fetchPage: async (url) => {
        if (url === techspian.CAREERS_URL) {
          return {
            status: 200,
            url: techspian.REDIRECTED_CAREERS_URL,
            html: PUBLIC_JOBS_HTML,
          }
        }

        return {
          status: 200,
          url: techspian.CONTACT_URL,
          html: CONTACT_HTML,
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    techspian.createTechspianScraper().run({
      fetchPage: async (url) => {
        if (url === techspian.CAREERS_URL) {
          return {
            status: 200,
            url: 'https://techspian.com/team',
            html: '<html><body><h1>Unexpected</h1></body></html>',
          }
        }

        return {
          status: 200,
          url: techspian.CONTACT_URL,
          html: CONTACT_HTML,
        }
      },
    }),
    /verified careers redirect changed materially/i,
  )
})
