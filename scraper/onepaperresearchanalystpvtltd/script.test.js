import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>OnePaper</title>
      <meta property="og:site_name" content="OnePaper" />
    </head>
    <body>
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/services">Services</a>
          <a href="/pricing">Pricing</a>
          <a href="/complaint-board">Complaint Board</a>
        </nav>
      </header>
      <main>
        <h1>Your search ends with our research!</h1>
        <p>In-depth market research and analysis to help you make more informed business decisions.</p>
      </main>
      <footer>
        <p>SEBI Research Analysts Registration Number - INH000008093</p>
        <p>Corporate Identification Number - U72900MH2020PTC346236</p>
        <p>OnePaper Research Analysts Pvt Ltd</p>
        <p>support@onepaper.in</p>
        <p>022-49392323</p>
      </footer>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>About OnePaper</title>
    </head>
    <body>
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/services">Services</a>
        </nav>
      </header>
      <main>
        <h1>About OnePaper</h1>
        <p>
          We specialize in conducting in-depth market research and analysis for our clients to help
          them make more informed business decisions.
        </p>
        <p>
          The corporate culture at OnePaper is centered around delivery of results.
        </p>
      </main>
      <footer>
        <p>SEBI Research Analysts Registration Number - INH000008093</p>
        <p>OnePaper Research Analysts Pvt Ltd</p>
        <p>support@onepaper.in</p>
      </footer>
    </body>
  </html>
`

const missingRoutePage = {
  status: 404,
  url: 'https://www.onepaper.in/careers',
  html: `
    <!doctype html>
    <html data-wf-domain="www.onepaper.in" data-wf-site="66e83bf8f453bba4ff5f7276">
      <head>
        <title>Not Found</title>
      </head>
      <body>
        <div class="utility-page-wrap">
          <div class="utility-page-content">
            <h2>Page Not Found</h2>
            <div>The page you are looking for doesn't exist or has been moved</div>
          </div>
        </div>
      </body>
    </html>
  `,
}

const trailingSlashRedirectPage = {
  status: 301,
  url: 'https://www.onepaper.in/careers/',
  location: 'https://www.onepaper.in/careers',
  html: `
    <html>
      <head>
        <title>301 Moved Permanently</title>
      </head>
      <body>
        <center><h1>301 Moved Permanently</h1></center>
        <hr />
        <center>openresty</center>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail(
      'Expected OnePaper Research Analysts Pvt Ltd scraper module at ./script.js',
    )
  }
}

test('OnePaper Research Analysts Pvt Ltd recognizes the verified first-party zero-public-careers surface', async () => {
  const onepaper = await loadModule()

  assert.equal(onepaper.SOURCE, 'onepaperresearchanalystpvtltd')
  assert.equal(onepaper.COMPANY, 'OnePaper Research Analysts Pvt Ltd')
  assert.equal(onepaper.HOMEPAGE_URL, 'https://www.onepaper.in/')
  assert.equal(onepaper.ABOUT_URL, 'https://www.onepaper.in/about')
  assert.deepEqual(onepaper.CAREERS_ROUTE_URLS, [
    'https://www.onepaper.in/careers',
    'https://www.onepaper.in/careers/',
    'https://www.onepaper.in/career',
    'https://www.onepaper.in/career/',
    'https://www.onepaper.in/jobs',
    'https://www.onepaper.in/jobs/',
    'https://www.onepaper.in/work-with-us',
    'https://www.onepaper.in/work-with-us/',
  ])

  assert.equal(onepaper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(onepaper.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(onepaper.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(onepaper.hasFirstPartyCareerLikeLink(aboutHtml), false)
  assert.equal(onepaper.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(onepaper.hasPublicJobsSignal(aboutHtml), false)
  assert.equal(onepaper.isVerifiedMissingCareersRoute(missingRoutePage), true)
  assert.equal(
    onepaper.isVerifiedTrailingSlashRedirect(
      trailingSlashRedirectPage,
      'https://www.onepaper.in/careers',
    ),
    true,
  )
})

test('OnePaper Research Analysts Pvt Ltd returns no jobs while the verified public surface exposes no careers board', async () => {
  const onepaper = await loadModule()
  const requestedUrls = []

  const jobs = await onepaper.createOnePaperResearchAnalystsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === onepaper.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === onepaper.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (onepaper.CAREERS_ROUTE_URLS.includes(url)) {
        if (url.endsWith('/')) {
          return {
            ...trailingSlashRedirectPage,
            url,
            location: url.replace(/\/$/, ''),
          }
        }

        return { ...missingRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    onepaper.HOMEPAGE_URL,
    onepaper.ABOUT_URL,
    ...onepaper.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('OnePaper Research Analysts Pvt Ltd fails closed when the verified public surface drifts', async () => {
  const onepaper = await loadModule()

  await assert.rejects(
    onepaper.createOnePaperResearchAnalystsScraper().run({
      fetchPage: async (url) => {
        if (url === onepaper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    onepaper.createOnePaperResearchAnalystsScraper().run({
      fetchPage: async (url) => {
        if (url === onepaper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === onepaper.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutHtml.replace(
              '</main>',
              '<p><a href="/careers">Careers</a></p></main>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about surface now exposes a first-party careers path/i,
  )

  await assert.rejects(
    onepaper.createOnePaperResearchAnalystsScraper().run({
      fetchPage: async (url) => {
        if (url === onepaper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === onepaper.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === onepaper.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current openings</p></body></html>',
          }
        }
        if (onepaper.CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          if (url.endsWith('/')) {
            return {
              ...trailingSlashRedirectPage,
              url,
              location: url.replace(/\/$/, ''),
            }
          }

          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )

  await assert.rejects(
    onepaper.createOnePaperResearchAnalystsScraper().run({
      fetchPage: async (url) => {
        if (url === onepaper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === onepaper.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === onepaper.CAREERS_ROUTE_URLS[1]) {
          return {
            status: 301,
            url,
            location: 'https://www.onepaper.in/unexpected-target',
            html: trailingSlashRedirectPage.html,
          }
        }
        if (url.endsWith('/')) {
          return {
            ...trailingSlashRedirectPage,
            url,
            location: url.replace(/\/$/, ''),
          }
        }
        if (onepaper.CAREERS_ROUTE_URLS.includes(url)) {
          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
