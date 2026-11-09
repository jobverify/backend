import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_PAGE_URL,
  HOMEPAGE_URL,
  createAliensGroupScraper,
  hasHomepageCareersSignal,
  hasMissingCareersRouteSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Aliens Group</title>
    </head>
    <body>
      <header>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </header>
      <main>
        <h1>Aliens Group</h1>
        <p>Luxury apartments and villas in Hyderabad.</p>
      </main>
    </body>
  </html>
`

const missingRoutePage = {
  status: 404,
  html: `
    <html>
      <head>
        <title>404 - Page Not Found</title>
      </head>
      <body>
        <h1>404</h1>
        <p>The page you are looking for does not exist.</p>
      </body>
    </html>
  `,
}

const careersPage = {
  status: 200,
  html: `
    <html>
      <head>
        <title>Careers | Aliens Group</title>
      </head>
      <body>
        <h1>Careers</h1>
        <p>Join our team.</p>
      </body>
    </html>
  `,
}

test('signal helpers recognize the verified Aliens Group homepage and missing careers routes', () => {
  assert.equal(HOMEPAGE_URL, 'https://www.aliensgroup.in/')
  assert.equal(CAREERS_PAGE_URL, 'https://www.aliensgroup.in/careers')
  assert.equal(CAREER_PAGE_URL, 'https://www.aliensgroup.in/career')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasHomepageCareersSignal(homepageHtml), false)
  assert.equal(hasMissingCareersRouteSignal(missingRoutePage), true)
})

test('run returns no jobs when the official homepage has no public careers signal and both checked routes are 404s', async () => {
  const requestedUrls = []

  const jobs = await createAliensGroupScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, html: homepageHtml }
      }

      if (url === CAREERS_PAGE_URL || url === CAREER_PAGE_URL) {
        return missingRoutePage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run throws when a checked careers route stops being a verified 404 page', async () => {
  await assert.rejects(
    createAliensGroupScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, html: homepageHtml }
        }

        if (url === CAREERS_PAGE_URL) {
          return careersPage
        }

        if (url === CAREER_PAGE_URL) {
          return missingRoutePage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Aliens Group public careers surface changed/i,
  )
})
