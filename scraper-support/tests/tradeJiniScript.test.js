import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Tradejini | Explore Opportunities &amp; Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Join our</h1>
      <h1>passionate team</h1>
      <p>Explore opportunities to grow, contribute, and make a real impact.</p>
      <a href="/careers/open-positions">See open positions</a>
      <section>
        <h2>Our Hiring Process</h2>
        <h3>Apply</h3>
        <p>Send us your resume and cover letter. Let’s get to know you.</p>
        <h3>Screening Call</h3>
        <h3>Technical Round</h3>
      </section>
    </main>
  </body>
</html>
`

const VERIFIED_CAREERS_WITH_NESTED_LINK_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Tradejini | Explore Opportunities &amp; Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Join our passionate team</h1>
      <p>Explore opportunities to grow, contribute, and make a real impact.</p>
      <a href="/careers/open-positions"><span>See open positions</span></a>
      <section>
        <h2>Our Hiring Process</h2>
      </section>
    </main>
  </body>
</html>
`

const OPEN_POSITIONS_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Tradejini | Explore Opportunities &amp; Join Our Team</title>
  </head>
  <body>
    <main>
      <h4>Search</h4>
      <h4>Trader</h4>
      <h4>Investor</h4>
      <h4>Learn</h4>
      <h4>Quick Links</h4>
      <h4>Updates</h4>
      <p>Let's power the journey for the top 1% of business leaders</p>
      <p>Trading Made Simple</p>
      <p>Crafted with care</p>
      <h4>Attention Investors &amp; Disclaimer</h4>
    </main>
  </body>
</html>
`

const OPEN_POSITIONS_WITH_JOB_RECORDS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Open Positions</h2>
      <a href="/careers/open-positions/senior-software-engineer">Senior Software Engineer</a>
      <p>Apply now</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tradejini/script.js')
  } catch {
    assert.fail('Expected TradeJini scraper module at ../../scraper/tradejini/script.js')
  }
}

test('TradeJini pins the verified first-party careers shell and empty open-positions route', async () => {
  const tradeJini = await loadModule()

  assert.equal(tradeJini.SOURCE, 'tradejini')
  assert.equal(tradeJini.COMPANY_NAME, 'TradeJini')
  assert.equal(tradeJini.OFFICIAL_BRAND_NAME, 'Tradejini Financial Services Pvt. Ltd.')
  assert.equal(tradeJini.VERIFIED_ON, '2026-07-17')
  assert.equal(tradeJini.CAREERS_URL, 'https://www.tradejini.com/careers')
  assert.equal(tradeJini.OPEN_POSITIONS_URL, 'https://www.tradejini.com/careers/open-positions')
  assert.equal(tradeJini.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    tradeJini.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(
    tradeJini.extractOpenPositionsUrl(VERIFIED_CAREERS_HTML),
    tradeJini.OPEN_POSITIONS_URL,
  )
  assert.equal(
    tradeJini.extractOpenPositionsUrl(VERIFIED_CAREERS_WITH_NESTED_LINK_HTML),
    tradeJini.OPEN_POSITIONS_URL,
  )
  assert.equal(tradeJini.hasPublicJobRecordsSignal(OPEN_POSITIONS_SHELL_HTML), false)
  assert.equal(tradeJini.hasPublicJobRecordsSignal(OPEN_POSITIONS_WITH_JOB_RECORDS_HTML), true)
})

test('TradeJini returns [] only while the verified first-party surfaces still expose no public job records', async () => {
  const tradeJini = await loadModule()
  const requestedUrls = []

  const jobs = await tradeJini.createTradeJiniScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tradeJini.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === tradeJini.OPEN_POSITIONS_URL) return OPEN_POSITIONS_SHELL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [tradeJini.CAREERS_URL, tradeJini.OPEN_POSITIONS_URL])
  assert.deepEqual(jobs, [])
})

test('TradeJini fails closed when the verified careers shell drifts or the open-positions route starts exposing public jobs', async () => {
  const tradeJini = await loadModule()

  await assert.rejects(
    tradeJini.createTradeJiniScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers shell/i,
  )

  await assert.rejects(
    tradeJini.createTradeJiniScraper().run({
      fetchText: async (url) => {
        if (url === tradeJini.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === tradeJini.OPEN_POSITIONS_URL) return OPEN_POSITIONS_WITH_JOB_RECORDS_HTML
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /open-positions route now exposes public job records/i,
  )
})
