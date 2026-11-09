import assert from 'node:assert/strict'
import test from 'node:test'

const sukoonModule = await import('../../scraper/sukoon/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  VERIFIED_SURFACE_CONTRACT,
  createSukoonScraper,
  run,
} = sukoonModule

const VERIFIED_SURFACE_HTML = `
  <html>
    <head>
      <title>Sukoon | Online Counselling, Life Coaching &amp; Ruqyah Sessions</title>
    </head>
    <body>
      <main>
        <h1>Sukoon</h1>
        <p>Find Guidance, Clarity &amp; Inner Peace with Sukoon.</p>
        <p>Online Counselling</p>
        <p>Life Coaching</p>
        <p>Ruqyah Sessions</p>
      </main>
    </body>
  </html>
`

test('Sukoon keeps its verified exact-name services surface fail-closed', async () => {
  assert.equal(SOURCE, 'sukoon')
  assert.equal(COMPANY, 'Sukoon')
  assert.equal(CAREERS_URL, 'https://trysukoon.com/')
  assert.equal(DISPOSITION, 'verified-exact-name-company-surface-no-public-listings')
  assert.match(
    VERIFIED_SURFACE_CONTRACT,
    /Tuesday, August 4, 2026.*exact-name public Sukoon services surface/i,
  )

  const scraper = createSukoonScraper()
  const jobs = await scraper.run({
    fetchHtml: async (url) => {
      assert.equal(url, CAREERS_URL)
      return VERIFIED_SURFACE_HTML
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(
    await run({
      fetchHtml: async () => VERIFIED_SURFACE_HTML,
    }),
    [],
  )
})

test('Sukoon rejects surfaces that lose the exact company name', async () => {
  const scraper = createSukoonScraper()

  await assert.rejects(
    () =>
      scraper.run({
        fetchHtml: async () => `
          <html>
            <body>
              <main>
                <h1>Mental health insurance</h1>
                <p>We are hiring across functions.</p>
              </main>
            </body>
          </html>
        `,
      }),
    /exact-name Sukoon public surface/i,
  )
})

test('Sukoon rejects surfaces that lose the verified services signal', async () => {
  const scraper = createSukoonScraper()

  await assert.rejects(
    () =>
      scraper.run({
        fetchHtml: async () => `
          <html>
            <body>
              <main>
                <h1>Sukoon</h1>
                <p>Mental health insurance for India.</p>
              </main>
            </body>
          </html>
        `,
      }),
    /services-marketplace signal/i,
  )
})

test('Sukoon rejects when a first-party public listings surface appears', async () => {
  const scraper = createSukoonScraper()

  await assert.rejects(
    () =>
      scraper.run({
        fetchHtml: async () => `
          <html>
            <body>
              <main>
                <h1>Sukoon</h1>
                <p>Online Counselling</p>
                <section>
                  <h2>Current Openings</h2>
                  <a href="/careers/founding-engineer">Founding Engineer</a>
                </section>
              </main>
            </body>
          </html>
        `,
      }),
    /first-party public job listings/i,
  )
})

test('Sukoon rejects when JobPosting markup appears on the verified surface', async () => {
  const scraper = createSukoonScraper()

  await assert.rejects(
    () =>
      scraper.run({
        fetchHtml: async () => `
          <html>
            <body>
              <main>
                <h1>Sukoon</h1>
                <p>Online Counselling</p>
              </main>
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Lead"}
              </script>
            </body>
          </html>
        `,
      }),
    /JobPosting markup/i,
  )
})
