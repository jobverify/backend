import assert from 'node:assert/strict'
import test from 'node:test'

const photomathIndiaModule = await import('../../scraper/photomathindia/script.js').catch(
  () => ({}),
)

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  GOOGLE_CAREERS_URL,
  HOMEPAGE_URL,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createPhotomathIndiaScraper,
  extractCareersHandoffUrl,
  hasVerifiedCompanySurface,
  isVerifiedGoogleCareersHandoff,
  run,
} = photomathIndiaModule

const VERIFIED_HOMEPAGE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Photomath - The Ultimate Math Help App | Math Explained</title>
      <link rel="canonical" href="https://photomath.com/" />
      <meta property="og:url" content="https://photomath.com/" />
    </head>
    <body>
      <main>
        <h1>Photomath</h1>
        <p>Need math help? Meet Photomath.</p>
        <a href="/careers/">Careers</a>
      </main>
    </body>
  </html>
`

const VERIFIED_GOOGLE_HANDOFF_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Search for your career at Google.</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <p>Jobs</p>
        <p>Students</p>
        <p>How we hire</p>
        <p>Equal Opportunity Google</p>
      </main>
    </body>
  </html>
`

test('Photomath India validates the Photomath homepage and the Google Careers handoff', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
      }
      if (url === CAREERS_URL) {
        return {
          status: 200,
          url: GOOGLE_CAREERS_URL,
          html: VERIFIED_GOOGLE_HANDOFF_HTML,
        }
      }
      assert.fail(`Unexpected fetchPage URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'photomathindia')
  assert.equal(COMPANY, 'Photomath India')
  assert.equal(OFFICIAL_BRAND, 'Photomath')
  assert.equal(DISPOSITION, 'verified-company-surface-with-google-careers-handoff')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Google Careers/i)
  assert.equal(typeof createPhotomathIndiaScraper, 'function')
  assert.equal(extractCareersHandoffUrl(VERIFIED_HOMEPAGE_HTML), CAREERS_URL)
  assert.equal(hasVerifiedCompanySurface(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(
    isVerifiedGoogleCareersHandoff({
      status: 200,
      url: GOOGLE_CAREERS_URL,
      html: VERIFIED_GOOGLE_HANDOFF_HTML,
    }),
    true,
  )
})

test('Photomath India rejects when the branded homepage disappears', async () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head><title>Example Learning App</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><head><title>Example Learning App</title></head><body><h1>Example</h1></body></html>',
      }),
    }),
    /official homepage/i,
  )
})

test('Photomath India rejects when the careers handoff no longer points to Google Careers', async () => {
  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: VERIFIED_HOMEPAGE_HTML }
        }

        return {
          status: 200,
          url: 'https://www.photomath.com/careers/',
          html: '<html><head><title>Photomath Careers</title></head><body><h1>Careers</h1></body></html>',
        }
      },
    }),
    /Google Careers handoff/i,
  )
})
