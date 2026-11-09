import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Adani Group: Explore Job Opportunities and Vacancies</title>
      <link rel="canonical" href="https://www.adani.com/careers" />
    </head>
    <body>
      <header><a href="/careers">Careers</a></header>
      <main>
        <h1>Careers at Adani Group</h1>
        <a href="/businesses/materials/cement">Cement</a>
        <h2>Current Openings</h2>
        <a href="https://www.adani.com/opportunity/#en/sites/CX_2027/requisitions">View Openings</a>
      </main>
      <footer>Adani Group</footer>
    </body>
  </html>
`

test('Adani Cement group careers identity cannot authorize a subsidiary empty inventory', async () => {
  const adaniCement = await import('../../scraper/adanicement/script.js')
  const requestedUrls = []

  assert.equal(adaniCement.hasOfficialCareersSignal(officialCareersHtml), true)

  await assert.rejects(adaniCement.createAdaniCementScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  }), /corporate Cement subsidiary identity changed/i)

  assert.deepEqual(requestedUrls, [adaniCement.CAREERS_URL, 'https://www.adani.com/businesses/materials/cement'])
})

test('Adani Cement fails closed when the official careers surface changes', async () => {
  const adaniCement = await import('../../scraper/adanicement/script.js')

  await assert.rejects(
    adaniCement.createAdaniCementScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /Adani Cement official careers surface changed/i,
  )
})
