import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at SplashLearn</title>
  </head>
  <body>
    <main>
      <p>1 in 7 elementary school children in the US love SplashLearn!</p>
      <h2>Culture at SplashLearn</h2>
      <p>At SplashLearn, we dig individuality.</p>
      <h2>Meet Our Founders</h2>
      <p>Arpit Jain - CEO and a Co-founder, SplashLearn.</p>
      <footer>StudyPad &amp; SplashLearn are registered Trademarks of StudyPad, Inc.</footer>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/splashlearn/script.js')
  } catch {
    assert.fail('Expected SplashLearn scraper module at ../../scraper/splashlearn/script.js')
  }
}

test('SplashLearn default careers-page fetch is bounded by an AbortSignal', async () => {
  const splashlearn = await loadModule()
  const originalFetch = globalThis.fetch
  const fetchCalls = []

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })

    return {
      status: 200,
      url,
      text: async () => officialCareersHtml,
    }
  }

  try {
    const jobs = await splashlearn.createSplashLearnScraper().run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(fetchCalls.map((call) => call.url), [splashlearn.CAREERS_PAGE_URL])
    assert.ok(fetchCalls[0].options.signal instanceof AbortSignal)
    assert.equal(fetchCalls[0].options.signal.aborted, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
