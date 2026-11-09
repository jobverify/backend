import assert from 'node:assert/strict'
import test from 'node:test'

const suprDailyModule = await import('../../scraper/suprdaily/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  VERIFIED_REDIRECT_HOST,
  createSuprDailyScraper,
  run,
} = suprDailyModule

const VERIFIED_REDIRECT_PAGE = {
  status: 200,
  url: 'https://www.keluarantotomacau.it.com/',
  html: `
    <html>
      <head>
        <title>Keluaran Toto Macau 2026 : Data Macau 6D & Pengeluaran 4D Hari Ini</title>
      </head>
      <body>
        <main>
          <p>Keluaran Toto Macau 2026</p>
          <a href="https://www.samsung.com/id/smartphones/galaxy-z-fold7/buy/">Example off-domain commerce link</a>
        </main>
      </body>
    </html>
  `,
}

test('Supr Daily validates the verified off-domain redirect drift and stays fail-closed', async () => {
  assert.equal(typeof run, 'function', 'Expected Supr Daily workbook batch-05 module.')

  let requestedUrl = null
  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrl = url
      return VERIFIED_REDIRECT_PAGE
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'suprdaily')
  assert.equal(COMPANY, 'Supr Daily')
  assert.equal(CAREERS_URL, 'https://www.suprdaily.com/')
  assert.equal(VERIFIED_REDIRECT_HOST, 'www.keluarantotomacau.it.com')
  assert.equal(DISPOSITION, 'verified-company-domain-redirect-drift-sentinel')
  assert.equal(typeof createSuprDailyScraper, 'function')
})

test('Supr Daily throws when the verified off-domain redirect disappears', async () => {
  assert.equal(
    typeof createSuprDailyScraper,
    'function',
    'Expected Supr Daily workbook batch-05 module.',
  )

  await assert.rejects(
    createSuprDailyScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: CAREERS_URL,
        html: '<html><body><main><h1>Supr Daily</h1></main></body></html>',
      }),
    }),
    /verified company-domain redirect drift changed/i,
  )
})

test('Supr Daily throws when a trustworthy public jobs surface appears', async () => {
  assert.equal(typeof run, 'function', 'Expected Supr Daily workbook batch-05 module.')

  await assert.rejects(
    run({
      fetchPage: async () => ({
        ...VERIFIED_REDIRECT_PAGE,
        html: `
          ${VERIFIED_REDIRECT_PAGE.html}
          <section>
            <iframe src="https://jobs.ashbyhq.com/suprdaily"></iframe>
          </section>
        `,
      }),
    }),
    /trustworthy public jobs surface/i,
  )
})

test('Supr Daily throws when public JobPosting markup appears on the redirected surface', async () => {
  assert.equal(typeof run, 'function', 'Expected Supr Daily workbook batch-05 module.')

  await assert.rejects(
    run({
      fetchPage: async () => ({
        ...VERIFIED_REDIRECT_PAGE,
        html: `
          ${VERIFIED_REDIRECT_PAGE.html}
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Associate"}
          </script>
        `,
      }),
    }),
    /JobPosting markup/i,
  )
})
