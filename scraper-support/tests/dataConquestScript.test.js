import assert from 'node:assert/strict'
import test from 'node:test'

const loadDataConquestModule = async () => {
  try {
    return await import('../../scraper/dataconquest/script.js')
  } catch {
    assert.fail('Expected Data Conquest scraper module at ../../scraper/dataconquest/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Data Conquest</title>
  </head>
  <body>
    <main>
      <h1>Data Conquest</h1>
      <p>Engineering and data-led solutions for modern business operations.</p>
      <a href="/shop">Shop</a>
      <a href="/contact">Contact</a>
    </main>
  </body>
</html>
`

test('Data Conquest validates the official public site before returning no listings', async () => {
  const dataConquest = await loadDataConquestModule()

  assert.equal(dataConquest.HOMEPAGE_URL, 'https://dataconquest.in/')
  assert.equal(dataConquest.hasOfficialDataConquestSignal(homepageHtml), true)
  assert.equal(dataConquest.hasPublicJobBoardSignal(homepageHtml), false)
})

test('Data Conquest returns an empty set when no public careers surface exists on the official site', async () => {
  const dataConquest = await loadDataConquestModule()
  const requestedUrls = []

  const jobs = await dataConquest.createDataConquestScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === dataConquest.HOMEPAGE_URL) return homepageHtml
      throw new Error(`Unexpected Data Conquest fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [dataConquest.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})
