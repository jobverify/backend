import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mobile, Laptop, Wallet & Credit Card Protection, Repair Services | OneAssist</title>
  </head>
  <body>
    <h1>What’s new?</h1>
    <p>Join 1.6 Crores+ customers</p>
    <p>Great Place to Work - Certified</p>
    <footer>
      <h2>OUR COMPANY</h2>
      <a href="https://oneassist.in/aboutus/">About us</a>
      <a href="https://oneassist.in/faq/">FAQ</a>
      <a href="https://blog.oneassist.in/">OneAssist Blog</a>
      <a href="https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer">Careers</a>
    </footer>
  </body>
</html>
`

const BROKEN_CAREERS_HTML = `
<!DOCTYPE html>
<html dir="ltr">
  <head>
    <title>Error: Active domain connection for this domain not found</title>
  </head>
  <body id="error-page">
    <div class="wp-die-message">
      Something unexpected happened while accessing this website.
      It looks like it doesn't have an active domain connection upgrade to link the requested domain name to the WordPress.com site.
      <a href="https://wordpress.com/support/domains/connect-existing-domain/">domain connection</a>
    </div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Positions</h1>
    <a href="https://jobs.example.com/claims-specialist">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/oneassist/script.js')
  } catch {
    assert.fail('Expected OneAssist scraper module at ../../scraper/oneassist/script.js')
  }
}

test('OneAssist sentinel helpers stay pinned to the official homepage footer link and broken careers subdomain', async () => {
  const oneAssist = await loadModule()

  assert.equal(oneAssist.COMPANY, 'OneAssist')
  assert.equal(oneAssist.OFFICIAL_BRAND_NAME, 'OneAssist')
  assert.equal(oneAssist.VERIFIED_ON, '2026-07-17')
  assert.equal(oneAssist.HOMEPAGE_URL, 'https://oneassist.in/')
  assert.equal(
    oneAssist.CAREERS_PAGE_URL,
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(oneAssist.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    oneAssist.extractVerifiedCareersPageUrl(HOMEPAGE_HTML),
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(oneAssist.hasBrokenCareersSurfaceSignal(BROKEN_CAREERS_HTML), true)
  assert.equal(oneAssist.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(oneAssist.pageExposesPublicJobListings(BROKEN_CAREERS_HTML), false)
  assert.equal(oneAssist.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    oneAssist.isExpectedTlsFailure({
      message: 'fetch failed',
      cause: {
        code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        message: 'Hostname/IP does not match certificate alt names',
      },
    }),
    true,
  )
})

test('OneAssist returns [] when the verified homepage links to the broken first-party careers subdomain', async () => {
  const oneAssist = await loadModule()
  const requestedUrls = []

  const jobs = await oneAssist.createOneAssistScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === oneAssist.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === oneAssist.CAREERS_PAGE_URL) {
        return { status: 403, url, html: BROKEN_CAREERS_HTML }
      }

      throw new Error(`Unexpected OneAssist URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    oneAssist.HOMEPAGE_URL,
    oneAssist.CAREERS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OneAssist also returns [] when the verified careers subdomain currently fails TLS hostname validation', async () => {
  const oneAssist = await loadModule()
  const requestedUrls = []

  const jobs = await oneAssist.createOneAssistScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === oneAssist.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === oneAssist.CAREERS_PAGE_URL) {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: {
            code: 'ERR_TLS_CERT_ALTNAME_INVALID',
            message: 'Hostname/IP does not match certificate alt names',
          },
        })
      }

      throw new Error(`Unexpected OneAssist URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    oneAssist.HOMEPAGE_URL,
    oneAssist.CAREERS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OneAssist fails closed when the verified homepage link or careers surface changes into a public jobs board', async () => {
  const oneAssist = await loadModule()

  await assert.rejects(
    oneAssist.createOneAssistScraper().run({
      fetchPage: async (url) => {
        if (url === oneAssist.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected OneAssist URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    oneAssist.createOneAssistScraper().run({
      fetchPage: async (url) => {
        if (url === oneAssist.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML.replace(
              'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
              'https://careers.oneassist.in/jobs',
            ),
          }
        }

        throw new Error(`Unexpected OneAssist URL: ${url}`)
      },
    }),
    /verified homepage careers handoff/i,
  )

  await assert.rejects(
    oneAssist.createOneAssistScraper().run({
      fetchPage: async (url) => {
        if (url === oneAssist.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === oneAssist.CAREERS_PAGE_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected OneAssist URL: ${url}`)
      },
    }),
    /careers surface now appears to expose public jobs/i,
  )
})
