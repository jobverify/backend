import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at SAP | SAP Careers</title>
  </head>
  <body>
    <h1>Jobs at SAP</h1>
    <label>Search by keyword</label>
    <label>Search by location</label>
    <p>Explore opportunities at SAP.</p>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sapariba/script.js')
  } catch {
    assert.fail('Expected SAP Ariba scraper module at ../../scraper/sapariba/script.js')
  }
}

test('SAP Ariba scraper stays pinned to the generic SAP careers baseline', async () => {
  const sapAriba = await loadScriptModule()

  assert.equal(sapAriba.SOURCE, 'sapariba')
  assert.equal(sapAriba.COMPANY, 'SAP Ariba')
  assert.equal(sapAriba.VERIFIED_ON, '2026-07-18')
  assert.equal(sapAriba.CAREERS_URL, 'https://www.sap.com/about/careers.html')
  assert.equal(sapAriba.PARENT_BRAND_NAME, 'SAP')
  assert.equal(sapAriba.hasGenericSapCareersSignal(careersHtml), true)
  assert.equal(sapAriba.hasExactSapAribaCareersSignal(careersHtml), false)
})

test('SAP Ariba scraper returns [] while the public surface remains generic-only', async () => {
  const sapAriba = await loadScriptModule()
  const jobs = await sapAriba.createSapAribaScraper().run({
    fetchPage: async (url) => ({ status: 200, url, html: careersHtml }),
  })

  assert.deepEqual(jobs, [])
})

test('SAP Ariba scraper fails closed when exact-name jobs appear', async () => {
  const sapAriba = await loadScriptModule()

  await assert.rejects(
    sapAriba.createSapAribaScraper().run({
      fetchPage: async () => ({ status: 200, url: sapAriba.CAREERS_URL, html: '<title>Unexpected</title>' }),
    }),
    /trusted first-party baseline/i,
  )

  await assert.rejects(
    sapAriba.createSapAribaScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: sapAriba.CAREERS_URL,
        html: `${careersHtml}<section><h2>Careers at SAP Ariba</h2><a>Apply now</a></section>`,
      }),
    }),
    /needs a real scraper/i,
  )
})
