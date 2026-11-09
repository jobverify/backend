import assert from 'node:assert/strict'
import test from 'node:test'

const wintWealthModule = await import('../../scraper/wintwealth/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createWintWealthScraper,
  detectPublicJobsSurface,
  hasVerifiedCompanySurface,
  run,
} = wintWealthModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>About Us: Democratizing Debt Investments in India</title>
      <meta property="og:url" content="https://www.wintwealth.com/about-us/" />
    </head>
    <body>
      <main>
        <h1>Democratising Debt Investments in India</h1>
        <section>
          <h2>Our Co-founders</h2>
        </section>
        <section>
          <p>8 lakh+ users trust Wint Wealth</p>
          <p>SEBI Registered broker</p>
          <p>For any query / feedback / clarifications, email at hello@wintwealth.com</p>
        </section>
        <footer>
          <a href="/terms-and-conditions/">Terms &amp; Conditions</a>
          <a href="/privacy-policy/">Privacy Policy</a>
        </footer>
      </main>
    </body>
  </html>
`

test('Wint Wealth stays fail-closed on the verified public company surface', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_COMPANY_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'wintwealth')
  assert.equal(COMPANY, 'Wint Wealth')
  assert.equal(OFFICIAL_BRAND, 'Wint Wealth')
  assert.equal(CAREERS_URL, 'https://www.wintwealth.com/about-us/')
  assert.equal(DISPOSITION, 'verified-exact-name-public-company-surface')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.equal(typeof createWintWealthScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(detectPublicJobsSurface(VERIFIED_COMPANY_SURFACE_HTML), null)
})

test('Wint Wealth rejects when the verified public company surface disappears', async () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head><title>About Example</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <head><title>About Example</title></head>
          <body><h1>Example</h1></body>
        </html>
      `,
    }),
    /verified public company surface/i,
  )
})

test('Wint Wealth rejects when a same-origin public jobs surface appears', async () => {
  const sameOriginJobsHtml = `
    ${VERIFIED_COMPANY_SURFACE_HTML}
    <section>
      <h2>Current Openings</h2>
      <a href="/careers/senior-analyst">Senior Analyst</a>
    </section>
  `

  assert.match(
    detectPublicJobsSurface(sameOriginJobsHtml) || '',
    /listing copy|https:\/\/www\.wintwealth\.com\/careers\/senior-analyst/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => sameOriginJobsHtml,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Wint Wealth rejects when a trusted ATS board or JobPosting markup appears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/wintwealth"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"Credit Analyst"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})
