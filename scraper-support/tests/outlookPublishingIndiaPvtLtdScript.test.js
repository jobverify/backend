import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'outlookpublishingindiapvtltd')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const aboutHtml = readFixture('about-us.html')
const contactHtml = readFixture('contact-us.html')

const missingRoutePage = {
  status: 404,
  url: 'https://www.outlookindia.com/careers',
  html: `
    <html>
      <head>
        <title>Outlook India - India's Best Magazine| Find Latest News, Top Headlines, Live Updates</title>
      </head>
      <body>
        <footer>
          <a href="/about-us">About Us</a>
          <a href="/contact-us">Contact Us</a>
        </footer>
      </body>
    </html>
  `,
}

const trailingSlashRedirectPage = {
  status: 301,
  url: 'https://www.outlookindia.com/careers/',
  location: '/careers',
  html: `
    <html>
      <head>
        <title>301 Moved Permanently</title>
      </head>
      <body></body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/outlookpublishingindiapvtltd/script.js')
  } catch {
    assert.fail(
      'Expected Outlook Publishing India Pvt. Ltd. scraper module at ../../scraper/outlookpublishingindiapvtltd/script.js',
    )
  }
}

test('Outlook Publishing India Pvt. Ltd. recognizes the verified first-party zero-public-careers surface', async () => {
  const outlook = await loadModule()

  assert.equal(outlook.SOURCE, 'outlookpublishingindiapvtltd')
  assert.equal(outlook.COMPANY, 'Outlook Publishing India Pvt. Ltd.')
  assert.equal(outlook.HOMEPAGE_URL, 'https://www.outlookindia.com/')
  assert.equal(outlook.ABOUT_URL, 'https://www.outlookindia.com/about-us')
  assert.equal(outlook.CONTACT_URL, 'https://www.outlookindia.com/contact-us')
  assert.deepEqual(outlook.CAREERS_ROUTE_URLS, [
    'https://www.outlookindia.com/careers',
    'https://www.outlookindia.com/careers/',
    'https://www.outlookindia.com/career',
    'https://www.outlookindia.com/career/',
    'https://www.outlookindia.com/jobs',
    'https://www.outlookindia.com/jobs/',
    'https://www.outlookindia.com/work-with-us',
    'https://www.outlookindia.com/work-with-us/',
  ])

  assert.equal(outlook.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(outlook.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(outlook.hasOfficialContactSignal(contactHtml), true)
  assert.equal(outlook.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(outlook.hasFirstPartyCareerLikeLink(aboutHtml), false)
  assert.equal(outlook.hasFirstPartyCareerLikeLink(contactHtml), false)
  assert.equal(outlook.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(outlook.hasPublicJobsSignal(aboutHtml), false)
  assert.equal(outlook.hasPublicJobsSignal(contactHtml), false)
  assert.equal(outlook.isVerifiedMissingCareersRoute(missingRoutePage), true)
  assert.equal(outlook.isVerifiedTrailingSlashRedirect(trailingSlashRedirectPage, '/careers'), true)
})

test('Outlook Publishing India Pvt. Ltd. returns no jobs while the verified public surface exposes no careers board', async () => {
  const outlook = await loadModule()
  const requestedUrls = []

  const jobs = await outlook.createOutlookPublishingIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === outlook.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === outlook.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === outlook.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (outlook.CAREERS_ROUTE_URLS.includes(url)) {
        if (url.endsWith('/')) {
          return {
            ...trailingSlashRedirectPage,
            url,
            location: new URL(url).pathname.replace(/\/$/, ''),
          }
        }

        return { ...missingRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    outlook.HOMEPAGE_URL,
    outlook.ABOUT_URL,
    outlook.CONTACT_URL,
    ...outlook.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Outlook Publishing India Pvt. Ltd. fails closed when the verified public surface drifts', async () => {
  const outlook = await loadModule()

  await assert.rejects(
    outlook.createOutlookPublishingIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === outlook.HOMEPAGE_URL) {
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
    outlook.createOutlookPublishingIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === outlook.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === outlook.ABOUT_URL) {
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
    outlook.createOutlookPublishingIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === outlook.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === outlook.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === outlook.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: contactHtml.replace(
              '</main>',
              '<section><h2>Current Openings</h2><a href="/jobs/sub-editor">Apply Now</a></section></main>',
            ),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact surface now exposes public jobs/i,
  )

  await assert.rejects(
    outlook.createOutlookPublishingIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === outlook.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === outlook.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === outlook.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === outlook.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1></body></html>',
          }
        }
        if (outlook.CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingRoutePage, url }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )

  await assert.rejects(
    outlook.createOutlookPublishingIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === outlook.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === outlook.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === outlook.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === outlook.CAREERS_ROUTE_URLS[1]) {
          return {
            status: 301,
            url,
            location: '/unexpected-target',
            html: trailingSlashRedirectPage.html,
          }
        }
        if (url.endsWith('/')) {
          return {
            ...trailingSlashRedirectPage,
            url,
            location: new URL(url).pathname.replace(/\/$/, ''),
          }
        }
        if (outlook.CAREERS_ROUTE_URLS.includes(url)) {
          return { ...missingRoutePage, url }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
