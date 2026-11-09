import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_PAGE_URL,
  CAREERS_ROUTE_URL,
  HOMEPAGE_URL,
  JOBS_ROUTE_URL,
  createSystemTwoScraper,
  hasCareersNavigationLink,
  hasOfficialAboutSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isVerifiedMissingCareerRoute,
} from './script.js'

const homepageHtml = `
  <html lang="en">
    <head>
      <title>System Two</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/projects">Work</a>
        <a href="/blog">Blog</a>
        <a href="/about">About</a>
      </nav>
      <main>
        <h1>System Two</h1>
        <p>Building agent-native products and documenting the process.</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <html lang="en">
    <head>
      <title>System Two</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/projects">Work</a>
        <a href="/blog">Blog</a>
        <a href="/about">About</a>
      </nav>
      <main>
        <h1>About</h1>
        <p>I'm Wesley. I build things with AI agents and document the process in public.</p>
      </main>
    </body>
  </html>
`

const missingRouteHtml = `
  <html lang="en">
    <head>
      <title>404: This page could not be found.</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/projects">Work</a>
        <a href="/blog">Blog</a>
        <a href="/about">About</a>
      </nav>
      <main>
        <h1>404</h1>
        <p>This page could not be found.</p>
      </main>
    </body>
  </html>
`

test('homepage and about helpers detect the verified System Two first-party surface', () => {
  assert.equal(HOMEPAGE_URL, 'https://system-two.ai/')
  assert.equal(ABOUT_PAGE_URL, 'https://system-two.ai/about')
  assert.equal(CAREERS_ROUTE_URL, 'https://system-two.ai/careers')
  assert.equal(JOBS_ROUTE_URL, 'https://system-two.ai/jobs')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(hasCareersNavigationLink(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(isVerifiedMissingCareerRoute(missingRouteHtml), true)
})

test('run returns no jobs when the verified homepage and about page stay stable and careers routes are 404s', async () => {
  const requestedUrls = []
  const jobs = await createSystemTwoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === ABOUT_PAGE_URL) return aboutHtml
      if (url === CAREERS_ROUTE_URL || url === JOBS_ROUTE_URL) return missingRouteHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    ABOUT_PAGE_URL,
    CAREERS_ROUTE_URL,
    JOBS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage starts exposing a careers link or hiring copy', async () => {
  const homepageWithCareers = `
    <html>
      <head><title>System Two</title></head>
      <body>
        <nav>
          <a href="/careers">Careers</a>
        </nav>
        <main>
          <p>We are hiring founding engineers.</p>
        </main>
      </body>
    </html>
  `

  await assert.rejects(
    createSystemTwoScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageWithCareers
        if (url === ABOUT_PAGE_URL) return aboutHtml
        if (url === CAREERS_ROUTE_URL || url === JOBS_ROUTE_URL) return missingRouteHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /System Two homepage no longer matches the verified no-public-jobs surface/i,
  )
})

test('run fails closed when a checked route stops being the verified 404 surface', async () => {
  const careersHtml = `
    <html>
      <head><title>Careers at System Two</title></head>
      <body>
        <h1>Open Roles</h1>
      </body>
    </html>
  `

  await assert.rejects(
    createSystemTwoScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_PAGE_URL) return aboutHtml
        if (url === CAREERS_ROUTE_URL) return careersHtml
        if (url === JOBS_ROUTE_URL) return missingRouteHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /System Two checked careers route no longer matches the verified 404 surface/i,
  )
})
