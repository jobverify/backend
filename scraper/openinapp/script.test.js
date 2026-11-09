import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_ROUTE_URL,
  CAREER_ROUTE_URL,
  JOBS_ROUTE_URL,
  createOpeninAppScraper,
  hasOfficialSiteSignal,
  hasCareersSignal,
  isMissingCareerRoute,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>OpeninApp - Best Link Shortener &amp; App Opener</title>
      <meta
        name="description"
        content="The ultimate link shortener. Now supporting Youtube, Instagram, Telegram, Linkedin and 100+ more platforms."
      />
    </head>
    <body>
      <main>
        <h1>OpeninApp</h1>
        <p>Loved by over 3 Million creators.</p>
      </main>
    </body>
  </html>
`

const notFoundHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>OpeninApp | 404 Not found</title>
      <meta property="og:image" content="https://openinapp.com/og-image.png" />
    </head>
    <body>
      <main>
        <h1>404 Not found</h1>
      </main>
    </body>
  </html>
`

test('site signal helpers detect the official homepage and branded missing career routes', () => {
  assert.equal(hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(hasCareersSignal(homepageHtml), false)
  assert.equal(isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when the homepage has no careers signal and public career routes resolve to the branded 404 page', async () => {
  const requestedUrls = []

  const jobs = await createOpeninAppScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) return homepageHtml
      if (
        url === CAREERS_ROUTE_URL
        || url === CAREER_ROUTE_URL
        || url === JOBS_ROUTE_URL
      ) {
        return notFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchRoutePage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 404,
        url,
        html: notFoundHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    CAREERS_ROUTE_URL,
    CAREER_ROUTE_URL,
    JOBS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run accepts live-style 404 route responses when the branded missing-route shell is still intact', async () => {
  const jobs = await createOpeninAppScraper().run({
    fetchText: async (url) => {
      if (url === CAREER_PAGE_URL) return homepageHtml
      throw new Error(`Unexpected homepage fetch URL: ${url}`)
    },
    fetchRoutePage: async (url) => ({
      status: 404,
      url,
      html: notFoundHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage or verified career routes change shape', async () => {
  await assert.rejects(
    createOpeninAppScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) {
          return homepageHtml.replace(
            '</main>',
            '<a href="/careers">Careers</a></main>',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchRoutePage: async (url) => ({
        status: 404,
        url,
        html: notFoundHtml,
      }),
    }),
    /public careers surface changed/i,
  )

  await assert.rejects(
    createOpeninAppScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) return homepageHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchRoutePage: async (url) => ({
        status: 404,
        url,
        html: url === CAREERS_ROUTE_URL
          ? '<html><body><h1>Open roles</h1></body></html>'
          : notFoundHtml,
      }),
    }),
    /verified missing careers routes changed/i,
  )
})
