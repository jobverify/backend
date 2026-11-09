import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'loyaltyjuggernaut',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const ABOUT_HTML = readFixture('about-us.html')
const MISSING_ROUTE_HTML = readFixture('missing-route-404.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/loyaltyjuggernaut/script.js')
  } catch {
    assert.fail('Expected Loyalty Juggernaut scraper module at ../../scraper/loyaltyjuggernaut/script.js')
  }
}

test('Loyalty Juggernaut scraper recognizes the verified homepage, about page, and missing-route careers surfaces', async () => {
  const loyaltyJuggernaut = await loadModule()

  assert.equal(loyaltyJuggernaut.SOURCE, 'loyaltyjuggernaut')
  assert.equal(loyaltyJuggernaut.COMPANY, 'Loyalty Juggernaut')
  assert.equal(loyaltyJuggernaut.HOMEPAGE_URL, 'https://www.lji.io/')
  assert.equal(loyaltyJuggernaut.ABOUT_URL, 'https://www.lji.io/about-us')
  assert.deepEqual(loyaltyJuggernaut.CAREERS_ROUTE_URLS, [
    'https://www.lji.io/careers',
    'https://www.lji.io/careers/',
    'https://www.lji.io/jobs',
    'https://www.lji.io/join-us',
  ])
  assert.equal(loyaltyJuggernaut.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(loyaltyJuggernaut.hasOfficialAboutSignal(ABOUT_HTML), true)
  assert.equal(loyaltyJuggernaut.hasFirstPartyCareerLikeLink(HOMEPAGE_HTML), false)
  assert.equal(loyaltyJuggernaut.hasFirstPartyCareerLikeLink(ABOUT_HTML), false)
  assert.equal(loyaltyJuggernaut.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(loyaltyJuggernaut.hasPublicJobsSignal(ABOUT_HTML), false)
  assert.equal(
    loyaltyJuggernaut.isVerifiedMissingCareersRoute({
      status: 404,
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
  assert.equal(
    loyaltyJuggernaut.isVerifiedMissingCareersRoute({
      status: 200,
      html: MISSING_ROUTE_HTML,
    }),
    false,
  )
})

test('Loyalty Juggernaut returns no jobs only while the verified homepage, about page, and missing careers routes remain unchanged', async () => {
  const loyaltyJuggernaut = await loadModule()
  const requestedUrls = []

  const jobs = await loyaltyJuggernaut.createLoyaltyJuggernautScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === loyaltyJuggernaut.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: HOMEPAGE_HTML,
        }
      }

      if (url === loyaltyJuggernaut.ABOUT_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: ABOUT_HTML,
        }
      }

      if (loyaltyJuggernaut.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    loyaltyJuggernaut.HOMEPAGE_URL,
    loyaltyJuggernaut.ABOUT_URL,
    ...loyaltyJuggernaut.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Loyalty Juggernaut fails closed when the verified homepage, about page, or careers routes drift', async () => {
  const loyaltyJuggernaut = await loadModule()

  await assert.rejects(
    loyaltyJuggernaut.createLoyaltyJuggernautScraper().run({
      fetchPage: async (url) => {
        if (url === loyaltyJuggernaut.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body>No LJI markers</body></html>',
          }
        }

        if (url === loyaltyJuggernaut.ABOUT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: ABOUT_HTML,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    loyaltyJuggernaut.createLoyaltyJuggernautScraper().run({
      fetchPage: async (url) => {
        if (url === loyaltyJuggernaut.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === loyaltyJuggernaut.ABOUT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>About Us</title></head><body>Broken</body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /verified about page/i,
  )

  await assert.rejects(
    loyaltyJuggernaut.createLoyaltyJuggernautScraper().run({
      fetchPage: async (url) => {
        if (url === loyaltyJuggernaut.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: HOMEPAGE_HTML,
          }
        }

        if (url === loyaltyJuggernaut.ABOUT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: ABOUT_HTML,
          }
        }

        if (url === loyaltyJuggernaut.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/platform-engineer">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: MISSING_ROUTE_HTML,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})


const currentAboutPage = `<html><head><title>About Us · Loyalty Juggernaut</title><meta name="description" content="Loyalty Juggernaut, founded 2015 in Palo Alto. 200+ people across 7 offices, building the loyalty operating layer the world&#39;s largest programs run on."></head><body><script type="application/ld+json">{"@type":"Organization","name":"Loyalty Juggernaut, Inc.","url":"https://lji.io"}</script><h1>Founded in Silicon Valley · 2015</h1><p>Leading the next era of enterprise loyalty.</p><p>Global headquarters: Palo Alto, CA</p><a href="/contact-us">Contact Us</a></body></html>`

test('Loyalty Juggernaut validates the current homepage identity and detects apex-domain careers links', async () => {
  const loyalty = await loadModule()
  const homepage = `<html><head><title>Loyalty Juggernaut · Loyalty as an Enterprise Growth Engine</title>
    <link rel="canonical" href="https://lji.io/" />
    <script type="application/ld+json">{"@type":"Organization","name":"Loyalty Juggernaut, Inc.","url":"https://lji.io"}</script>
    </head><body><img alt="Loyalty Juggernaut" /><a href="/about-us">About</a><a href="/contact-us">Contact</a>
    <p>Enterprise loyalty platform. Agentic AI. Real-time intelligence. Built on GRAVTY</p></body></html>`
  assert.equal(loyalty.hasOfficialHomepageSignal(homepage), true)
  assert.equal(loyalty.hasOfficialHomepageSignal(homepage.replace('"name":"Loyalty Juggernaut, Inc."', '"name":"Unrelated"')), false)
  assert.equal(loyalty.hasOfficialHomepageSignal(homepage.replace('href="https://lji.io/"', 'href="https://unrelated.example/"')), false)
  const withCareers = homepage.replace('</body>', '<a href="https://lji.io/careers">Careers</a></body>')
  assert.equal(loyalty.hasFirstPartyCareerLikeLink(withCareers), true)
  assert.deepEqual(await loyalty.createLoyaltyJuggernautScraper().run({
    fetchPage: async (url) => ({ status: loyalty.CAREERS_ROUTE_URLS.includes(url) ? 404 : 200,
      html: url === loyalty.HOMEPAGE_URL ? homepage : url === loyalty.ABOUT_URL ? currentAboutPage : MISSING_ROUTE_HTML }),
  }), [])
  await assert.rejects(loyalty.createLoyaltyJuggernautScraper().run({
    fetchPage: async () => ({ status: 200, html: withCareers }),
  }), /homepage now exposes a first-party careers or public jobs surface/)
})

test('Loyalty Juggernaut validates the current about-page branding while checking all careers routes for jobs', async () => {
  const loyalty = await loadModule()
  const urls = []
  const jobs = await loyalty.createLoyaltyJuggernautScraper().run({
    fetchPage: async (url) => {
      urls.push(url)
      return { status: loyalty.CAREERS_ROUTE_URLS.includes(url) ? 404 : 200, url, headers: {}, html: url === loyalty.HOMEPAGE_URL ? HOMEPAGE_HTML : url === loyalty.ABOUT_URL ? currentAboutPage : MISSING_ROUTE_HTML }
    },
  })
  assert.deepEqual(jobs, [])
  assert.deepEqual(urls, [loyalty.HOMEPAGE_URL, loyalty.ABOUT_URL, ...loyalty.CAREERS_ROUTE_URLS])
  assert.equal(loyalty.hasOfficialAboutSignal(currentAboutPage.replace('"url":"https://lji.io"', '"url":"https://unrelated.example"')), false)
})
