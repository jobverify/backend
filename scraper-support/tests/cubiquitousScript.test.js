import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <head><title>Home | My Site</title></head>
    <body>
      <h1>Cubiquitous Technologies</h1>
      <p>Unleash the Power of Loyalty by rewarding your repeat customers</p>
      <p>Contact@cubiquitous.in</p>
    </body>
  </html>
`

test('Cubiquitous returns no jobs when its official public site has no job listings', async () => {
  const cubiquitous = await import('../../scraper/cubiquitous/script.js')

  assert.equal(cubiquitous.hasOfficialSiteSignal(homepageHtml), true)

  const jobs = await cubiquitous.createCubiquitousScraper().run({
    fetchText: async (url) => {
      assert.equal(url, cubiquitous.CAREER_PAGE_URL)
      return homepageHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Cubiquitous returns no jobs when its official site currently responds with HTTP 404', async () => {
  const cubiquitous = await import('../../scraper/cubiquitous/script.js')

  const jobs = await cubiquitous.createCubiquitousScraper().run({
    fetchText: async () => {
      throw new Error(`HTTP 404 for ${cubiquitous.CAREER_PAGE_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
})
