import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FIRST_PARTY_CAREER_ROUTES,
  FIRST_PARTY_PAGE_URLS,
  createGeniusAdvisorScraper,
  hasOfficialAboutSignal,
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
} from '../../scraper/geniusadvisor/script.js'

const HOMEPAGE_HTML = `
  <html>
    <head>
      <title>The Genius Advisors | Homepage</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/about">Who We Are?</a>
        <a href="/services">What We Do?</a>
        <a href="/insights">Insights</a>
        <a href="/contact">Start a Conversation</a>
      </nav>
      <main>
        <h1>Building Brands. Creating Value.</h1>
        <p>We help retail and consumer businesses build clarity, strong systems, and sustainable growth — from strategy to execution.</p>
        <p>Mumbai, India</p>
        <p>+91 96862 04879</p>
      </main>
    </body>
  </html>
`

const ABOUT_HTML = `
  <html>
    <head>
      <title>The Genius Advisors | About Us</title>
    </head>
    <body>
      <h1>Who We Are?</h1>
      <p>Experience That Guides Real Growth.</p>
      <p>The Genius Advisors is a founder-led advisory firm helping retail and consumer businesses build, transform, and grow.</p>
      <p>Jai M Bihani Founder &amp; Principal Advisor</p>
      <p>Mumbai, India</p>
      <p>+91 96862 04879</p>
    </body>
  </html>
`

const CONTACT_HTML = `
  <html>
    <head>
      <title>The Genius Advisors | Contact Us</title>
    </head>
    <body>
      <h1>Get in Touch</h1>
      <p>Jai M Bihani</p>
      <p>Mumbai, India</p>
      <p>hello@thegeniusadvisor.com</p>
      <p>+91 96862 04879</p>
    </body>
  </html>
`

test('Genius Advisor sentinel accepts the current brochure-site drift from Saturday, July 25, 2026', () => {
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasOfficialAboutSignal(ABOUT_HTML), true)
  assert.equal(hasOfficialContactSignal(CONTACT_HTML), true)
})

test('Genius Advisor returns no jobs when adjacent careers routes only fall back to the brochure homepage', async () => {
  const jobs = await createGeniusAdvisorScraper().run({
    fetchText: async (url) => {
      if (url === FIRST_PARTY_PAGE_URLS[0]) return HOMEPAGE_HTML
      if (url === FIRST_PARTY_PAGE_URLS[1]) return ABOUT_HTML
      if (url === FIRST_PARTY_PAGE_URLS[2]) return CONTACT_HTML
      throw new Error(`Unexpected browser URL: ${url}`)
    },
    probeUrl: async (url) => {
      assert.ok(FIRST_PARTY_CAREER_ROUTES.includes(url))
      return {
        url,
        finalUrl: url,
        status: 200,
        html: HOMEPAGE_HTML,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(jobs, [])
})

test('Genius Advisor still fails closed if a first-party jobs listing becomes reachable', async () => {
  await assert.rejects(
    createGeniusAdvisorScraper().run({
      fetchText: async (url) => {
        if (url === FIRST_PARTY_PAGE_URLS[0]) return HOMEPAGE_HTML
        if (url === FIRST_PARTY_PAGE_URLS[1]) return ABOUT_HTML
        if (url === FIRST_PARTY_PAGE_URLS[2]) return CONTACT_HTML
        throw new Error(`Unexpected browser URL: ${url}`)
      },
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: 200,
        html: `
          <html>
            <head><title>Careers</title></head>
            <body>
              <h1>Join our team</h1>
              <a href="/jobs/brand-manager">Search jobs</a>
            </body>
          </html>
        `,
        errorKind: null,
      }),
    }),
    /public jobs surface now appears reachable/i,
  )
})
