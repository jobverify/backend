import assert from 'node:assert/strict'
import test from 'node:test'

const selfscribeModule = await import('../../scraper/selfscribe/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createSelfscribeScraper,
  detectPublicJobsSurface,
  hasVerifiedCompanySurface,
  run,
} = selfscribeModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>SelfScribe AI | AI documentation for clinicians</title>
      <link rel="canonical" href="https://www.selfscribeai.com/" />
      <meta property="og:url" content="https://www.selfscribeai.com/" />
    </head>
    <body>
      <main>
        <h1>Selfscribe</h1>
        <p>Selfscribe builds AI documentation tools for healthcare teams.</p>
        <a href="/contact">Contact</a>
      </main>
    </body>
  </html>
`

test('Selfscribe stays fail-closed on the verified exact-name public company surface', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_COMPANY_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'selfscribe')
  assert.equal(COMPANY, 'Selfscribe')
  assert.equal(OFFICIAL_BRAND, 'Selfscribe')
  assert.equal(CAREERS_URL, 'https://www.selfscribeai.com/')
  assert.equal(DISPOSITION, 'verified-exact-name-public-company-surface')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /first-party public surface reviewed for Selfscribe/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /returns no jobs|stays fail-closed/i)
  assert.equal(typeof createSelfscribeScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(detectPublicJobsSurface(VERIFIED_COMPANY_SURFACE_HTML), null)
})

test('Selfscribe rejects when the verified exact-name company surface disappears', async () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head><title>Example AI</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <head><title>Example AI</title></head>
          <body><h1>Example</h1></body>
        </html>
      `,
    }),
    /verified public company surface/i,
  )
})

test('Selfscribe rejects when a same-origin public jobs surface appears', async () => {
  const sameOriginJobsHtml = `
    ${VERIFIED_COMPANY_SURFACE_HTML}
    <section>
      <h2>Current Openings</h2>
      <a href="/careers/ml-engineer">ML Engineer</a>
    </section>
  `

  assert.match(
    detectPublicJobsSurface(sameOriginJobsHtml) || '',
    /listing copy|https:\/\/www\.selfscribeai\.com\/careers\/ml-engineer/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => sameOriginJobsHtml,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Selfscribe rejects when a trusted ATS board or JobPosting markup appears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/selfscribe"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"Clinical AI Engineer"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Selfscribe accepts the live no-www canonical or og:url domain shape', () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head>
          <title>SelfScribe AI | Best AI Humanizer</title>
          <meta property="og:url" content="https://selfscribeai.com" />
        </head>
        <body>
          <h1>SelfScribe AI</h1>
        </body>
      </html>
    `),
    true,
  )
})
