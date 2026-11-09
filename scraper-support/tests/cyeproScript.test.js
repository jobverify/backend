import assert from 'node:assert/strict'
import test from 'node:test'

const officialSiteHtml = `
  <html>
    <head><title>Cyepro CRM</title></head>
    <body>
      <h1>Transform Your Dealership</h1>
      <a href="mailto:vps@cyepro.com">vps@cyepro.com</a>
      <a href="tel:+917331152152">+91 7331152152</a>
    </body>
  </html>
`

test('CyePro returns no jobs when its official site has no public careers listings', async () => {
  const cyepro = await import('../../scraper/cyepro/script.js')
  const requestedUrls = []

  const jobs = await cyepro.createCyeproScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialSiteHtml
    },
  })

  assert.equal(cyepro.hasOfficialSiteSignal(officialSiteHtml), true)
  assert.deepEqual(requestedUrls, ['https://www.cyepro.com/'])
  assert.deepEqual(jobs, [])
})
