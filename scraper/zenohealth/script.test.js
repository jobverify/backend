import assert from 'node:assert/strict'
import test from 'node:test'

const loadZenoHealthModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Zeno Health scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Helping the world is perhaps the most rewarding way to grow in your career and life</h1>
      <section>Work culture at Zeno Health</section>
      <section>Join us</section>
      <a href="https://www.linkedin.com/company/zeno-health/mycompany/?viewAsMember=true">
        View our LinkedIn page for current openings
      </a>
    </main>
  </body>
</html>
`

const jsShellHtml = `
<!doctype html>
<html lang="en">
  <head><title>Zeno Health</title></head>
  <body>--></body>
</html>
`

const currentShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zeno Health</title>
    <meta
      name="description"
      content="Zeno Health is a healthcare brand that makes medicines affordable and accessible to all, we are on a journey to educate Indians about the value of generic medicines"
    />
    <meta property="og:url" content="https://zeno.health">
  </head>
  <body>
    <script src="runtime.js"></script>
    <script src="main.js"></script>
  </body>
</html>
`

test('Zeno Health validates the verified fail-closed careers contract', async () => {
  const zenoHealth = await loadZenoHealthModule()

  assert.equal(zenoHealth.SOURCE, 'zenohealth')
  assert.equal(zenoHealth.CAREERS_URL, 'https://corporate.zeno.health/careers')
  assert.doesNotThrow(() => zenoHealth.assertVerifiedPublicCareersSurface(officialCareersHtml))
  assert.doesNotThrow(() => zenoHealth.assertVerifiedLinkedInOpeningsHandoff(officialCareersHtml))
  assert.doesNotThrow(() => zenoHealth.assertNoPublicJobsSurface(officialCareersHtml))
})

test('Zeno Health keeps a JavaScript shell unresolved without activating a browser', async () => {
  const zenoHealth = await loadZenoHealthModule()
  const requestedBrowserUrls = []

  await assert.rejects(zenoHealth.createZenoHealthScraper().run({
    fetchPage: async url => ({ status: 200, url, html: jsShellHtml }),
    fetchBrowserHtml: async (url) => {
      requestedBrowserUrls.push(url)
      return officialCareersHtml
    },
  }), error => error.failureKind === 'coverage_gap')

  assert.deepEqual(requestedBrowserUrls, [])
})

test('Zeno Health cannot certify current inventory from the captured first-party shell', async () => {
  const zenoHealth = await loadZenoHealthModule()

  await assert.rejects(zenoHealth.createZenoHealthScraper().run({
    fetchPage: async url => ({ status: 200, url, html: currentShellHtml }),
    fetchBrowserHtml: async () => {
      assert.fail('Browser fallback was not expected for the current verified shell')
    },
  }), error => error.failureKind === 'coverage_gap' && error.recruitmentObservations.nativeRecords === 0)
})

test('Zeno Health fails closed when the browser-rendered contract also changes', async () => {
  const zenoHealth = await loadZenoHealthModule()

  await assert.rejects(
    zenoHealth.createZenoHealthScraper().run({
      fetchPage: async url => ({ status: 200, url, html: jsShellHtml }),
      fetchBrowserHtml: async () => '<main><h1>Careers</h1></main>',
    }),
    error => error.failureKind === 'coverage_gap',
  )
})
