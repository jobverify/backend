import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Tradejini | Explore Opportunities &amp; Join Our Team</title>
  </head>
  <body>
    <h1>Join our passionate team</h1>
    <p>Explore opportunities to grow, contribute, and make a real impact.</p>
    <a href="https://www.tradejini.com/careers/open-positions">See open positions</a>
    <section>Our hiring process</section>
  </body>
</html>
`

const openPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Tradejini | Explore Opportunities &amp; Join Our Team</title>
  </head>
  <body>
    <h1>Let's power the journey for the top 1% of business leaders</h1>
    <div>Search</div>
    <div>Trading Made Simple</div>
    <div>Quick Links</div>
    <div>Crafted with care</div>
    <div>Attention Investors & Disclaimer</div>
  </body>
</html>
`

test('TradeJini recognizes the current careers shell and no-jobs open-positions page', async () => {
  const tradejini = await loadModule()

  assert.equal(tradejini.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    tradejini.extractOpenPositionsUrl(careersHtml),
    'https://www.tradejini.com/careers/open-positions',
  )
  assert.equal(tradejini.hasVerifiedOpenPositionsShellSignal(openPositionsHtml), true)
  assert.equal(tradejini.hasPublicJobRecordsSignal(openPositionsHtml), false)
})

test('TradeJini returns no jobs while the verified open-positions route remains a non-listing shell', async () => {
  const tradejini = await loadModule()

  const jobs = await tradejini.createTradeJiniScraper().run({
    fetchText: async (url) => {
      if (url === tradejini.CAREERS_URL) return careersHtml
      if (url === tradejini.OPEN_POSITIONS_URL) return openPositionsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
