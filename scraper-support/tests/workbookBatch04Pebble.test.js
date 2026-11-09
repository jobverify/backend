import assert from 'node:assert/strict'
import test from 'node:test'

const pebbleModule = await import('../../scraper/pebble/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createPebbleScraper,
  detectPublicJobsSurface,
  hasVerifiedCompanySurface,
  run,
} = pebbleModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Pebble | Smartwatches, Earbuds, Speakers, and Accessories</title>
      <link rel="canonical" href="https://www.pebblecart.com/" />
      <meta property="og:url" content="https://www.pebblecart.com/" />
      <meta property="og:site_name" content="Pebble" />
    </head>
    <body>
      <main>
        <h1>Pebble</h1>
        <p>Pebble builds smart wearables and audio products for everyday use.</p>
        <a href="/support">Support</a>
      </main>
    </body>
  </html>
`

test('Pebble stays fail-closed on the verified exact-name public company surface', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_COMPANY_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'pebble')
  assert.equal(COMPANY, 'Pebble')
  assert.equal(OFFICIAL_BRAND, 'Pebble')
  assert.equal(CAREERS_URL, 'https://www.pebblecart.com/')
  assert.equal(DISPOSITION, 'verified-exact-name-public-company-surface')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /does not establish a stable enumerable public jobs contract/i,
  )
  assert.equal(typeof createPebbleScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(detectPublicJobsSurface(VERIFIED_COMPANY_SURFACE_HTML), null)
})

test('Pebble rejects when the verified exact-name company surface disappears', async () => {
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

test('Pebble rejects when a same-origin public jobs surface appears', async () => {
  const sameOriginJobsHtml = `
    ${VERIFIED_COMPANY_SURFACE_HTML}
    <section>
      <h2>Current Openings</h2>
      <a href="/careers/hardware-engineer">Hardware Engineer</a>
    </section>
  `

  assert.match(
    detectPublicJobsSurface(sameOriginJobsHtml) || '',
    /listing copy|https:\/\/www\.pebblecart\.com\/careers\/hardware-engineer/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => sameOriginJobsHtml,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Pebble rejects when a trusted ATS board or JobPosting markup appears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/pebble"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"Growth Manager"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})
