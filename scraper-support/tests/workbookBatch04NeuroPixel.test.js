import assert from 'node:assert/strict'
import test from 'node:test'

const neuroPixelModule = await import('../../scraper/neuropixel/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createNeuroPixelScraper,
  detectPublicJobsSurface,
  hasVerifiedCompanySurface,
  run,
} = neuroPixelModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>NeuroPixel.AI | Vision intelligence for manufacturing teams</title>
      <link rel="canonical" href="https://www.neuropixel.ai/" />
      <meta property="og:url" content="https://www.neuropixel.ai/" />
    </head>
    <body>
      <main>
        <h1>NeuroPixel</h1>
        <p>NeuroPixel builds vision intelligence systems for industrial teams.</p>
        <a href="/products">Products</a>
      </main>
    </body>
  </html>
`

test('NeuroPixel stays fail-closed on the verified exact-name public company surface', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_COMPANY_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'neuropixel')
  assert.equal(COMPANY, 'NeuroPixel')
  assert.equal(OFFICIAL_BRAND, 'NeuroPixel')
  assert.equal(CAREERS_URL, 'https://www.neuropixel.ai/')
  assert.equal(DISPOSITION, 'verified-exact-name-public-surface-fail-closed-sentinel')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.equal(typeof createNeuroPixelScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(detectPublicJobsSurface(VERIFIED_COMPANY_SURFACE_HTML), null)
})

test('NeuroPixel rejects when the verified exact-name company surface disappears', async () => {
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
    /verified exact-name public company surface/i,
  )
})

test('NeuroPixel rejects when a trustworthy jobs surface appears on the verified page', async () => {
  const sameOriginJobsHtml = `
    ${VERIFIED_COMPANY_SURFACE_HTML}
    <section>
      <h2>Current Openings</h2>
      <a href="/careers/computer-vision-engineer">Computer Vision Engineer</a>
    </section>
  `

  assert.match(
    detectPublicJobsSurface(sameOriginJobsHtml) || '',
    /listing copy|https:\/\/www\.neuropixel\.ai\/careers\/computer-vision-engineer/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => sameOriginJobsHtml,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/neuropixel"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})

test('NeuroPixel rejects when JobPosting markup appears on the verified page', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"ML Engineer"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})
