import assert from 'node:assert/strict'
import test from 'node:test'

const loadIndoMimModule = async () => {
  try {
    return await import('../../scraper/indomim/script.js')
  } catch {
    assert.fail('Expected INDO-MIM scraper module at ../../scraper/indomim/script.js')
  }
}

const careersHtml = `
  <html>
    <head><title>Career - INDO-MIM</title></head>
    <body>
      <h2>CURRENT OPENINGS</h2>
      <p>INDO-MIM believes that our people are what drive our success.</p>
      <p>INDO-MIM is a place that follows strict safety and security measures to protect our most valuable asset, our people.</p>
      <h2>EX-EMPLOYEE BGV</h2>
      <p>
        For all background verification inquiries related to former employees, authorized organizations are requested to contact us at
        exempbgv@indo-mim.com.
      </p>
      <h2>Explore Opportunities</h2>
      <form>
        <label>FIRST NAME *</label>
        <label>LAST NAME *</label>
        <label>EMAIL ADDRESS *</label>
        <label>PHONE NUMBER</label>
        <label>TELL MORE ABOUT YOU</label>
      </form>
    </body>
  </html>
`

test('INDO-MIM scraper targets the official careers page and recognizes the verified no-listings surface', async () => {
  const indomim = await loadIndoMimModule()

  assert.equal(indomim.CAREER_PAGE_URL, 'https://www.indo-mim.com/careers/')
  assert.equal(indomim.VERIFIED_ON, '2026-08-07')
  assert.equal(indomim.hasOfficialCareersSurface(careersHtml), true)
})

test('run returns no jobs when INDO-MIM exposes only its public explore-opportunities form', async () => {
  const indomim = await loadIndoMimModule()
  const requestedUrls = []

  const jobs = await indomim.createIndoMimScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === indomim.CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [indomim.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run returns no jobs when INDO-MIM is temporarily fronted by the verified Sucuri redirect challenge', async () => {
  const indomim = await loadIndoMimModule()

  const jobs = await indomim.createIndoMimScraper().run({
    fetchPage: async (url) => ({
      status: 307,
      url,
      html: `
        <html>
          <head><title>You are being redirected...</title></head>
          <body>
            <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
            <script>var sucuri_cloudproxy_js = '';</script>
          </body>
        </html>
      `,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the INDO-MIM official careers surface changes', async () => {
  const indomim = await loadIndoMimModule()

  await assert.rejects(
    indomim.createIndoMimScraper().run({
      fetchText: async () => '<html><body><h1>Open positions</h1></body></html>',
    }),
    /verified public no-listings surface/i,
  )
})
