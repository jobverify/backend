import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>About Us</title>
    <link rel="canonical" href="https://www.fablestreet.com/pages/about-us" />
    <meta name="description" content="about-us" />
  </head>
  <body>
    <nav>
      <a href="/pages/about-us">About Us</a>
    </nav>
    <main>
      <section>
        <h1>About Us</h1>
        <p>Find Your Best FIT</p>
      </section>
      <footer>
        <p>CONTACT US</p>
        <p>Fable Street Lifestyle Solutions Private Limited, Plot No. 335, Udyog Vihar, Phase IV, Gurugram, Haryana - 122002</p>
        <p>For Info/Issues: care@fablestreet.com</p>
        <p>For Jobs: careers@fablestreet.com</p>
      </footer>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>About Us</title>
  </head>
  <body>
    <main>
      <p>Find Your Best FIT</p>
      <p>Fable Street Lifestyle Solutions Private Limited</p>
      <a href="https://boards.greenhouse.io/fablestreet">Careers at FableStreet</a>
      <p>care@fablestreet.com</p>
      <p>careers@fablestreet.com</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fablestreet/script.js')
  } catch {
    assert.fail('Expected Fablestreet sentinel scraper module at ../../scraper/fablestreet/script.js')
  }
}

test('Fablestreet accepts the current exact-name about page shell and still fails closed with no public jobs board', async () => {
  const fablestreet = await loadModule()

  assert.doesNotThrow(() => fablestreet.assertVerifiedOfficialPublicSurface(CURRENT_ABOUT_PAGE_HTML))
  assert.doesNotThrow(() => fablestreet.assertNoPublicJobsSurface(CURRENT_ABOUT_PAGE_HTML, fablestreet.CAREERS_URL))

  const jobs = await fablestreet.createFablestreetScraper().run({
    fetchHtml: async (url) => {
      assert.equal(url, fablestreet.CAREERS_URL)
      return CURRENT_ABOUT_PAGE_HTML
    },
  })

  assert.deepEqual(jobs, [])
})

test('Fablestreet still fails closed when a trustworthy public ATS board appears on the official surface', async () => {
  const fablestreet = await loadModule()

  assert.throws(
    () => fablestreet.assertNoPublicJobsSurface(PUBLIC_JOBS_HTML, fablestreet.CAREERS_URL),
    /public jobs surface/i,
  )
})
