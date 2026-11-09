import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team: Careers</title>
  </head>
  <body>
    <main>
      <h1>Unleash Your Career With ShipDelight</h1>
      <p>At ShipDelight, we're not just shaping the future of logistics; we're redefining it.</p>
      <h2>ShipDelight&#x27;s People First Culture</h2>
      <h2>Current Job Openings</h2>
      <p>No open position available!</p>
      <p>Our mission is to lead a logistics revolution powered by smart technology for modern Bharat.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shipdelight/script.js')
  } catch {
    assert.fail('Expected Shipdelight scraper module at ../../scraper/shipdelight/script.js')
  }
}

test('Shipdelight helpers stay pinned to the verified official empty careers page', async () => {
  const shipdelight = await loadModule()

  assert.equal(shipdelight.SOURCE, 'shipdelight')
  assert.equal(shipdelight.COMPANY_NAME, 'Shipdelight')
  assert.equal(shipdelight.OFFICIAL_BRAND_NAME, 'Shipdelight Logistics Technologies Pvt Ltd.')
  assert.equal(shipdelight.VERIFIED_ON, '2026-07-17')
  assert.equal(shipdelight.CAREERS_URL, 'https://shipdelight.com/career')
  assert.equal(shipdelight.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(shipdelight.hasVerifiedEmptyOpeningsSignal(careersHtml), true)
  assert.equal(
    shipdelight.hasVerifiedEmptyOpeningsSignal(
      careersHtml.replace('No open position available!', 'Applications opening soon'),
    ),
    false,
  )
})

test('Shipdelight run validates the official empty careers page and returns an honest empty list', async () => {
  const shipdelight = await loadModule()
  const requestedUrls = []

  const jobs = await shipdelight.createShipdelightScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [shipdelight.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Shipdelight fails closed when the verified careers shell or empty-state marker drifts', async () => {
  const shipdelight = await loadModule()

  await assert.rejects(
    shipdelight.createShipdelightScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified shipdelight careers page/i,
  )

  await assert.rejects(
    shipdelight.createShipdelightScraper().run({
      fetchText: async () => careersHtml.replace('No open position available!', 'Open roles below'),
    }),
    /verified empty openings state/i,
  )
})
