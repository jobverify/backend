import assert from 'node:assert/strict'
import test from 'node:test'

const loadGepModule = async () => {
  try {
    return await import('../../scraper/gep/script.js')
  } catch {
    assert.fail('Expected GEP scraper module at ../../scraper/gep/script.js')
  }
}

const buildCareersHtml = () => `
<!doctype html>
<html>
  <head>
    <title>Careers | GEP</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "GEP"
      }
    </script>
    <script type="module" crossorigin src="/assets/app.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('extractSearchResults returns no jobs when the official GEP careers page exposes only a frontend shell', async () => {
  const gep = await loadGepModule()

  assert.equal(gep.buildSearchUrl(), gep.CAREERS_PAGE_URL)
  assert.deepEqual(gep.extractSearchResults(buildCareersHtml()), [])
})

test('run fetches the official GEP careers page and returns an empty result set when no public openings are exposed', async () => {
  const gep = await loadGepModule()
  const requestedUrls = []
  const scraper = gep.createGepScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === gep.CAREERS_PAGE_URL) return buildCareersHtml()
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [gep.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})
