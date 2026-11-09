import assert from 'node:assert/strict'
import test from 'node:test'

const smartshiftModule = await import('../../scraper/smartshift/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createSmartshiftScraper,
  detectPublicJobsSurface,
  hasVerifiedCompanySurface,
  run,
} = smartshiftModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Smartshift | Official Company Site</title>
      <link rel="canonical" href="https://www.smartshiftnow.com/" />
      <meta property="og:url" content="https://www.smartshiftnow.com/" />
    </head>
    <body>
      <main>
        <h1>Smartshift</h1>
        <p>Smartshift company information and product overview.</p>
        <a href="/contact">Contact</a>
      </main>
    </body>
  </html>
`

test('Smartshift stays fail-closed on the verified public company surface', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_COMPANY_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'smartshift')
  assert.equal(COMPANY, 'Smartshift')
  assert.equal(OFFICIAL_BRAND, 'Smartshift')
  assert.equal(CAREERS_URL, 'https://www.smartshiftnow.com/')
  assert.equal(DISPOSITION, 'verified-public-company-surface-fail-closed-sentinel')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/www\.smartshiftnow\.com\/ was the live first-party public surface reviewed for Smartshift/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /pins the exact workbook name to the verified public company surface/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /returns no jobs until a verifiable public openings flow is implemented/i,
  )
  assert.equal(typeof createSmartshiftScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(detectPublicJobsSurface(VERIFIED_COMPANY_SURFACE_HTML), null)
})

test('Smartshift rejects when the verified public company surface disappears', async () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head><title>Example Company</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <head><title>Example Company</title></head>
          <body><h1>Example</h1></body>
        </html>
      `,
    }),
    /verified public company surface/i,
  )
})

test('Smartshift rejects when a same-origin public jobs surface appears', async () => {
  const sameOriginJobsHtml = `
    ${VERIFIED_COMPANY_SURFACE_HTML}
    <section>
      <h2>Current Openings</h2>
      <a href="/careers/senior-analyst">Senior Analyst</a>
    </section>
  `

  assert.match(
    detectPublicJobsSurface(sameOriginJobsHtml) || '',
    /listing copy|https:\/\/www\.smartshiftnow\.com\/careers\/senior-analyst/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => sameOriginJobsHtml,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Smartshift rejects when a trusted ATS board or JobPosting markup appears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/smartshift"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Analyst"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Smartshift accepts the live smartshift.com canonical handoff', () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head>
          <title>SmartShift | Custom Software Solutions for Growing Businesses</title>
          <link rel="canonical" href="https://www.smartshift.com/" />
          <meta property="og:url" content="https://www.smartshift.com/" />
        </head>
        <body>
          <h1>SmartShift</h1>
        </body>
      </html>
    `),
    true,
  )
})
