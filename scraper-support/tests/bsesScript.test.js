import assert from 'node:assert/strict'
import test from 'node:test'

const landingPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>BSES</title>
    <link href="https://www.bsesdelhi.com/web/bses" rel="canonical" />
  </head>
  <body>
    <h1>Navigation</h1>
    <p>Home - BSES</p>
    <a href="/web/brpl/home">BSES Rajdhani Power Limited</a>
    <a href="/web/bypl/home">BSES Yamuna Power Limited</a>
    <p>BSES Bhawan, Nehru Place, New Delhi 110019</p>
  </body>
</html>
`

const loadBsesModule = async () => {
  try {
    return await import('../../scraper/bses/script.js')
  } catch {
    assert.fail('Expected BSES scraper module at ../../scraper/bses/script.js')
  }
}

test('BSES recognizes the current official landing page shape without public job signals', async () => {
  const bses = await loadBsesModule()

  assert.equal(bses.CAREER_PAGE_URL, 'https://www.bsesdelhi.com/')
  assert.equal(bses.hasOfficialBsesPageShape(landingPageHtml), true)
})

test('BSES returns no jobs only behind the verified official landing page sentinel', async () => {
  const bses = await loadBsesModule()

  const jobs = await bses.createBsesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, bses.CAREER_PAGE_URL)
      return landingPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
