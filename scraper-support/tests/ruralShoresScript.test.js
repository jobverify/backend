import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-13T00:00:00.000Z'

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - RuralShores</title>
  </head>
  <body>
    <header>
      <a href="/career.aspx" aria-current="page">Careers</a>
    </header>
    <main>
      <h1>Build a Rewarding Career with RuralShores</h1>
      <h2>Why Join RuralShores?</h2>
      <h2>Life at RuralShores</h2>
      <h2>Join Our Talent Network</h2>
      <p>Stay connected with RuralShores for future opportunities.</p>
      <a href="mailto:careers@ruralshores.com">careers@ruralshores.com</a>
      <a href="mailto:careers@ruralshores.com?subject=Join%20Our%20Talent%20Network">Apply Now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ruralshores/script.js')
  } catch {
    assert.fail('Expected RuralShores scraper module at ../../scraper/ruralshores/script.js')
  }
}

test('RuralShores stays pinned to the current first-party empty careers shell', async () => {
  const ruralShores = await loadModule()

  assert.equal(ruralShores.SOURCE, 'ruralshores')
  assert.equal(ruralShores.COMPANY_NAME, 'RuralShores')
  assert.equal(ruralShores.OFFICIAL_CAREERS_URL, 'https://www.ruralshores.com/career.aspx')
  assert.deepEqual(ruralShores.LEGACY_MISSING_ROUTE_URLS, [
    'https://www.ruralshores.com/career.html',
    'https://www.ruralshores.com/careers',
    'https://www.ruralshores.com/career',
    'https://www.ruralshores.com/jobs',
  ])
  assert.equal(ruralShores.hasOfficialRuralShoresCareersSignals(currentCareersHtml), true)
  assert.deepEqual(ruralShores.extractVisibleJobCards(currentCareersHtml), [])
})

test('RuralShores returns [] when the verified careers page exposes only the talent-network shell', async () => {
  const ruralShores = await loadModule()
  const jobs = await ruralShores.createRuralShoresScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => currentCareersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('RuralShores fails closed when the careers shell drifts materially', async () => {
  const ruralShores = await loadModule()

  await assert.rejects(
    ruralShores.createRuralShoresScraper().run({
      fetchText: async () => '<html><head><title>Careers</title></head><body><h1>Open roles</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
