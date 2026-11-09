import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amaze</title>
  </head>
  <body>
    <nav>
      <a href="/creators">For Creators</a>
      <a href="/brands">For Brands</a>
      <a href="/about-us">About</a>
    </nav>
    <main>
      <h1>Amaze Commerce is live</h1>
      <p>Create Something Amazing.</p>
      <p>Amaze helps creators monetize their audiences and helps brands reach high-intent consumers through creator-led commerce, livestream shopping, media, and content experiences.</p>
      <p>1.7 BILLION+ Lifetime Fan Reach</p>
    </main>
    <footer>
      <a href="https://jobs.lever.co/amaze">Careers</a>
    </footer>
  </body>
</html>
`

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About</title>
  </head>
  <body>
    <main>
      <h1>Ambition can never be boxed in</h1>
      <p>Commerce is changing. We’re here for the people leading the pack.</p>
      <p>From Youtubers to CMOs, we help innovative, entrepreneurial people turn their wild ideas into revenue realities.</p>
    </main>
    <footer>
      <a href="https://jobs.lever.co/amaze">Careers</a>
    </footer>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact</title>
  </head>
  <body>
    <main>
      <h1>Get In Touch With Us</h1>
      <p>Have a question or need support? We&#x27;re here to help&mdash;reach out and we&#x27;ll get back to you shortly.</p>
      <p><a href="mailto:support@amaze.co">support@amaze.co</a></p>
    </main>
    <footer>
      <a href="https://jobs.lever.co/amaze">Careers</a>
    </footer>
  </body>
</html>
`

const firstPartyNotFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    <main>
      <h1>Page Not Found</h1>
      <p>The page you are looking for doesn't exist or has been moved</p>
      <a href="/">Go Home</a>
    </main>
  </body>
</html>
`

const brokenLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not found – 404 error</title>
  </head>
  <body>
    <main>
      <h1>Sorry, we couldn't find anything here</h1>
      <p>The job posting you're looking for might have closed, or it has been removed. (404 error).</p>
      <p>Jobs powered by</p>
    </main>
  </body>
</html>
`

const loadAmazeModule = async () => {
  try {
    return await import('../../scraper/amaze/script.js')
  } catch {
    assert.fail('Expected Amaze scraper module at ../../scraper/amaze/script.js')
  }
}

test('Amaze sentinel pins the verified official pages, dead public careers handoff, and first-party 404 routes from July 15, 2026', async () => {
  const amaze = await loadAmazeModule()

  assert.equal(amaze.SOURCE, 'amaze')
  assert.equal(amaze.COMPANY, 'Amaze')
  assert.equal(amaze.OFFICIAL_BRAND_NAME, 'Amaze')
  assert.equal(amaze.VERIFIED_AT, '2026-07-15')
  assert.equal(amaze.HOMEPAGE_ENTRY_URL, 'https://amaze.co/')
  assert.equal(amaze.HOMEPAGE_URL, 'https://www.amaze.co/')
  assert.equal(amaze.ABOUT_PAGE_URL, 'https://www.amaze.co/about-us')
  assert.equal(amaze.CONTACT_PAGE_URL, 'https://www.amaze.co/contact')
  assert.equal(amaze.BROKEN_CAREERS_HANDOFF_URL, 'https://jobs.lever.co/amaze')
  assert.deepEqual(amaze.CAREERS_ROUTE_URLS, [
    'https://amaze.co/careers',
    'https://amaze.co/jobs',
  ])
  assert.deepEqual(amaze.extractJobsHandoffUrls(homepageHtml), ['https://jobs.lever.co/amaze'])
  assert.deepEqual(amaze.extractJobsHandoffUrls(aboutPageHtml), ['https://jobs.lever.co/amaze'])
  assert.deepEqual(amaze.extractJobsHandoffUrls(contactPageHtml), ['https://jobs.lever.co/amaze'])
  assert.equal(amaze.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(amaze.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(amaze.hasOfficialContactPageSignal(contactPageHtml), true)
  assert.equal(
    amaze.hasUnexpectedLiveJobsSignal(
      '<html><body><h1>Current openings</h1><a href="https://jobs.lever.co/amaze-2">Apply now</a></body></html>',
    ),
    true,
  )
  assert.equal(
    amaze.hasVerifiedFirstPartyNotFoundRouteSurface({
      status: 404,
      url: 'https://www.amaze.co/careers',
      html: firstPartyNotFoundHtml,
    }),
    true,
  )
  assert.equal(
    amaze.hasVerifiedBrokenLeverBoardSurface({
      status: 404,
      url: 'https://jobs.lever.co/amaze',
      html: brokenLeverBoardHtml,
    }),
    true,
  )
})

test('Amaze sentinel returns [] only while the official pages keep the dead careers handoff and the first-party routes remain 404', async () => {
  const amaze = await loadAmazeModule()
  const requestedUrls = []

  const jobs = await amaze.createAmazeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === amaze.HOMEPAGE_ENTRY_URL) {
        return { status: 200, url: amaze.HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === amaze.ABOUT_PAGE_URL) {
        return { status: 200, url, html: aboutPageHtml }
      }

      if (url === amaze.CONTACT_PAGE_URL) {
        return { status: 200, url, html: contactPageHtml }
      }

      if (url === amaze.CAREERS_ROUTE_URLS[0]) {
        return { status: 404, url: 'https://www.amaze.co/careers', html: firstPartyNotFoundHtml }
      }

      if (url === amaze.CAREERS_ROUTE_URLS[1]) {
        return { status: 404, url: 'https://www.amaze.co/jobs', html: firstPartyNotFoundHtml }
      }

      if (url === amaze.BROKEN_CAREERS_HANDOFF_URL) {
        return { status: 404, url, html: brokenLeverBoardHtml }
      }

      if (url === amaze.NATIVE_POSTINGS_URL) {
        return { status: 404, url, html: '{"ok":false,"error":"Document not found"}' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amaze.HOMEPAGE_ENTRY_URL,
    amaze.ABOUT_PAGE_URL,
    amaze.CONTACT_PAGE_URL,
    ...amaze.CAREERS_ROUTE_URLS,
    amaze.BROKEN_CAREERS_HANDOFF_URL,
    amaze.NATIVE_POSTINGS_URL,
    amaze.HOMEPAGE_ENTRY_URL,
    amaze.BROKEN_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Amaze sentinel fails closed when the official pages, first-party routes, or dead careers handoff drift', async () => {
  const amaze = await loadAmazeModule()

  await assert.rejects(
    amaze.createAmazeScraper().run({
      fetchPage: async (url) => {
        if (url === amaze.HOMEPAGE_ENTRY_URL) {
          return { status: 200, url: amaze.HOMEPAGE_URL, html: homepageHtml.replace('https://jobs.lever.co/amaze', 'https://jobs.lever.co/amaze-live') }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage surface/i,
  )

  await assert.rejects(
    amaze.createAmazeScraper().run({
      fetchPage: async (url) => {
        if (url === amaze.HOMEPAGE_ENTRY_URL) {
          return { status: 200, url: amaze.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === amaze.ABOUT_PAGE_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }

        if (url === amaze.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        if (url === amaze.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url: 'https://www.amaze.co/careers',
            html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (url === amaze.CAREERS_ROUTE_URLS[1]) {
          return { status: 404, url: 'https://www.amaze.co/jobs', html: firstPartyNotFoundHtml }
        }

        if (url === amaze.BROKEN_CAREERS_HANDOFF_URL) {
          return { status: 404, url, html: brokenLeverBoardHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )

  await assert.rejects(
    amaze.createAmazeScraper().run({
      fetchPage: async (url) => {
        if (url === amaze.HOMEPAGE_ENTRY_URL) {
          return { status: 200, url: amaze.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === amaze.ABOUT_PAGE_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }

        if (url === amaze.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        if (amaze.CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 404,
            url: url === amaze.CAREERS_ROUTE_URLS[0] ? 'https://www.amaze.co/careers' : 'https://www.amaze.co/jobs',
            html: firstPartyNotFoundHtml,
          }
        }

        if (url === amaze.BROKEN_CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><p>Jobs powered by Lever</p></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers handoff changed materially/i,
  )
})
