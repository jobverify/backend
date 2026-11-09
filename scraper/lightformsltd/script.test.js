import assert from 'node:assert/strict'
import test from 'node:test'

let scraperModule = {}

try {
  scraperModule = await import('./script.js')
} catch {
  scraperModule = {}
}

const {
  SOURCE,
  COMPANY,
  HOMEPAGE_URL,
  CONTACT_PAGE_URL,
  CAREERS_ROUTE_URL,
  JOBS_ROUTE_URL,
  WORK_WITH_US_ROUTE_URL,
  createLightFormsLtdScraper = () => ({
    async run() {
      throw new Error('Light Forms Ltd scraper not implemented')
    },
  }),
  hasOfficialHomepageSignal = () => false,
  hasContactPageSignal = () => false,
  isVerifiedMissingRouteError = () => false,
} = scraperModule

const officialHomepageHtml = `
  <html lang="en">
    <head>
      <title>Light Forms - Made to Measure Lighting Solutions</title>
      <meta
        name="description"
        content="Light Forms creates high performance, technically advanced and elegantly designed lighting solutions for sale into the international market."
      />
    </head>
    <body>
      <main>
        <h1>Light Forms</h1>
        <p>Light Forms creates high performance, technically advanced and elegantly designed lighting solutions.</p>
      </main>
      <footer>
        <div class="company-name">Light Forms Asia</div>
        <div>Light Forms Ltd<br>All rights reserved<br>&copy;2026</div>
      </footer>
    </body>
  </html>
`

const verifiedContactPageHtml = `
  <html lang="en">
    <head>
      <title>Contact Us | Light Forms</title>
    </head>
    <body>
      <main>
        <h2>Locations</h2>
        <h3>Light Forms Asia Sales Office</h3>
        <p>ask@lightforms.com</p>
        <form id="contact_me2">
          <input type="email" name="work_with_us_email" />
          <textarea name="work_with_us_message"></textarea>
        </form>
      </main>
      <footer>
        <!--<a href="careers/" target="_blank">Careers</a><br>-->
      </footer>
    </body>
  </html>
`

test('Light Forms Ltd scraper recognizes the verified homepage, contact surface, and missing-route errors', () => {
  assert.equal(SOURCE, 'lightformsltd')
  assert.equal(COMPANY, 'Light Forms Ltd')
  assert.equal(HOMEPAGE_URL, 'https://www.lightforms.com/')
  assert.equal(CONTACT_PAGE_URL, 'https://www.lightforms.com/contact/')
  assert.equal(CAREERS_ROUTE_URL, 'https://www.lightforms.com/careers/')
  assert.equal(JOBS_ROUTE_URL, 'https://www.lightforms.com/jobs/')
  assert.equal(WORK_WITH_US_ROUTE_URL, 'https://www.lightforms.com/work-with-us/')
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(hasContactPageSignal(verifiedContactPageHtml), true)
  assert.equal(hasContactPageSignal('<html><title>Contact</title></html>'), false)
  assert.equal(
    isVerifiedMissingRouteError(new Error(`HTTP 404 for ${CAREERS_ROUTE_URL}`), CAREERS_ROUTE_URL),
    true,
  )
  assert.equal(
    isVerifiedMissingRouteError(new Error(`HTTP 404 for ${JOBS_ROUTE_URL}`), JOBS_ROUTE_URL),
    true,
  )
  assert.equal(
    isVerifiedMissingRouteError(
      new Error(`HTTP 404 for ${WORK_WITH_US_ROUTE_URL}`),
      WORK_WITH_US_ROUTE_URL,
    ),
    true,
  )
  assert.equal(
    isVerifiedMissingRouteError(new Error(`HTTP 500 for ${CAREERS_ROUTE_URL}`), CAREERS_ROUTE_URL),
    false,
  )
})

test('run returns no jobs when Light Forms Ltd only exposes the verified homepage, contact page, and missing career routes', async () => {
  const requestedUrls = []
  const jobs = await createLightFormsLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return officialHomepageHtml
      }

      if (url === CONTACT_PAGE_URL) {
        return verifiedContactPageHtml
      }

      if ([CAREERS_ROUTE_URL, JOBS_ROUTE_URL, WORK_WITH_US_ROUTE_URL].includes(url)) {
        throw new Error(`HTTP 404 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [HOMEPAGE_URL, CONTACT_PAGE_URL, CAREERS_ROUTE_URL, JOBS_ROUTE_URL, WORK_WITH_US_ROUTE_URL],
  )
  assert.deepEqual(jobs, [])
})

test('run fails closed when the Light Forms homepage no longer matches the verified official surface', async () => {
  await assert.rejects(
    createLightFormsLtdScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>Coming soon</body></html>',
    }),
    /Light Forms homepage no longer matches the verified official site/i,
  )
})

test('run fails closed when the Light Forms contact page no longer matches the verified work-with-us surface', async () => {
  await assert.rejects(
    createLightFormsLtdScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return officialHomepageHtml
        }

        if (url === CONTACT_PAGE_URL) {
          return '<html><head><title>Contact Us | Light Forms</title></head><body><h1>Contact</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Light Forms contact page no longer matches the verified work-with-us surface/i,
  )
})

test('run fails closed when a previously missing Light Forms route starts resolving publicly', async () => {
  await assert.rejects(
    createLightFormsLtdScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return officialHomepageHtml
        }

        if (url === CONTACT_PAGE_URL) {
          return verifiedContactPageHtml
        }

        if (url === CAREERS_ROUTE_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
        }

        if (url === JOBS_ROUTE_URL || url === WORK_WITH_US_ROUTE_URL) {
          throw new Error(`HTTP 404 for ${url}`)
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Light Forms careers routes no longer match the verified public missing-route surface/i,
  )
})
