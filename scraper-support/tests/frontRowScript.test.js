import assert from 'node:assert/strict'
import test from 'node:test'

const shutdownUpdateHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FrontRow Update - FrontRow - Medium</title>
  </head>
  <body>
    <main>
      <h1>FrontRow Update</h1>
      <a href="https://play.google.com/store/apps/details?id=com.frontrow.app">Open in app</a>
      <p>Unfortunately, FrontRow shut down a few months ago. Thank you for your support and love for the product and we are extremely sorry we won’t be able to support your learning in the future.</p>
      <p>Written by FrontRow</p>
      <p>Sep 13, 2023</p>
    </main>
  </body>
</html>
`

const homepageRedirectPage = {
  ok: true,
  status: 200,
  url: 'https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2',
  text: shutdownUpdateHtml,
}

const shutdownArticlePage = {
  ok: true,
  status: 200,
  url: 'https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2',
  text: shutdownUpdateHtml,
}

const loadFrontRowModule = async () => {
  try {
    return await import('../../scraper/frontrow/script.js')
  } catch {
    assert.fail('Expected FrontRow scraper module at ../../scraper/frontrow/script.js')
  }
}

test('FrontRow sentinel constants stay pinned to the verified shutdown redirect surface', async () => {
  const frontRow = await loadFrontRowModule()

  assert.equal(frontRow.SOURCE, 'frontrow')
  assert.equal(frontRow.COMPANY, 'FrontRow')
  assert.equal(frontRow.OFFICIAL_BRAND_NAME, 'FrontRow')
  assert.equal(frontRow.VERIFIED_ON, '2026-08-13')
  assert.equal(frontRow.HOMEPAGE_URL, 'https://frontrow.co.in/')
  assert.equal(
    frontRow.SHUTDOWN_UPDATE_URL,
    'https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2',
  )
  assert.match(frontRow.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(frontRow.hasVerifiedShutdownUpdateSignal(shutdownUpdateHtml), true)
  assert.equal(frontRow.hasPublicJobsSignal(shutdownUpdateHtml), false)
  assert.equal(
    frontRow.hasPublicJobsSignal('<a href="https://jobs.lever.co/frontrow">Open positions</a>'),
    true,
  )
  assert.equal(frontRow.isExpectedHomepageRedirect(homepageRedirectPage), true)
})

test('FrontRow sentinel returns [] only while the homepage still redirects to the official shutdown update', async () => {
  const frontRow = await loadFrontRowModule()
  const requestedUrls = []

  const jobs = await frontRow.createFrontRowScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === frontRow.HOMEPAGE_URL) {
        return homepageRedirectPage
      }

      if (url === frontRow.SHUTDOWN_UPDATE_URL) {
        return shutdownArticlePage
      }

      throw new Error(`Unexpected FrontRow URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    frontRow.HOMEPAGE_URL,
    frontRow.SHUTDOWN_UPDATE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('FrontRow sentinel fails closed when the verified shutdown redirect or article drifts materially', async () => {
  const frontRow = await loadFrontRowModule()

  await assert.rejects(
    frontRow.createFrontRowScraper().run({
      fetchPage: async (url) => {
        if (url === frontRow.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url: 'https://frontrow.co.in/',
            text: '<html><body><h1>FrontRow</h1></body></html>',
          }
        }

        throw new Error(`Unexpected FrontRow URL: ${url}`)
      },
    }),
    /homepage no longer redirects to the verified shutdown update/i,
  )

  await assert.rejects(
    frontRow.createFrontRowScraper().run({
      fetchPage: async (url) => {
        if (url === frontRow.HOMEPAGE_URL) {
          return homepageRedirectPage
        }

        return {
          ok: true,
          status: 200,
          url,
          text: shutdownUpdateHtml.replace('shut down a few months ago', 'is hiring again'),
        }
      },
    }),
    /verified shutdown update no longer matches/i,
  )

  await assert.rejects(
    frontRow.createFrontRowScraper().run({
      fetchPage: async (url) => {
        if (url === frontRow.HOMEPAGE_URL) {
          return {
            ...homepageRedirectPage,
            text: `${shutdownUpdateHtml}<a href="https://jobs.lever.co/frontrow">Apply now</a>`,
          }
        }

        return shutdownArticlePage
      },
    }),
    /appears to expose public jobs/i,
  )
})
