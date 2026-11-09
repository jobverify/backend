import assert from 'node:assert/strict'
import test from 'node:test'

const loadCasaRetailAiModule = async () => {
  try {
    return await import('../../scraper/casaretailai/script.js')
  } catch {
    assert.fail('Expected Casa Retail AI scraper module at ../../scraper/casaretailai/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Casa Retail AI</title>
  </head>
  <body>
    <main>
      <h1>Casa Retail AI</h1>
      <p>AI-first retail intelligence for modern commerce teams.</p>
      <a href="/company">Company</a>
    </main>
  </body>
</html>
`

const companyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Company | Casa Retail AI</title>
  </head>
  <body>
    <main>
      <h1>Company</h1>
      <p>Learn how Casa Retail AI helps retailers operate smarter.</p>
      <a href="/">Back to home</a>
    </main>
  </body>
</html>
`

test('Casa Retail AI validates the verified public brand surfaces before returning no listings', async () => {
  const casa = await loadCasaRetailAiModule()

  assert.equal(casa.HOMEPAGE_URL, 'https://casaretail.ai/')
  assert.equal(casa.COMPANY_URL, 'https://casaretail.ai/company')
  assert.equal(casa.hasOfficialCasaRetailAiSignal(homepageHtml), true)
  assert.equal(casa.hasOfficialCasaRetailAiSignal(companyPageHtml), true)
  assert.equal(casa.hasPublicJobBoardSignal(homepageHtml), false)
  assert.equal(casa.hasPublicJobBoardSignal(companyPageHtml), false)
})

test('Casa Retail AI returns an empty set when only marketing/about pages are publicly exposed', async () => {
  const casa = await loadCasaRetailAiModule()
  const requestedUrls = []

  const jobs = await casa.createCasaRetailAiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === casa.HOMEPAGE_URL) return homepageHtml
      if (url === casa.COMPANY_URL) return companyPageHtml
      throw new Error(`Unexpected Casa Retail AI fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    casa.HOMEPAGE_URL,
    casa.COMPANY_URL,
  ])
  assert.deepEqual(jobs, [])
})
