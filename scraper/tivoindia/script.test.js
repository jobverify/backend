import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>With TiVo, the choice is always yours.</h1>
    <p>A smart TV Powered by TiVo gives you the power to choose what you want to watch.</p>
    <a href="https://www.xperi.com/careers/">Careers</a>
    <a href="https://www.xperi.com/company/">Company</a>
    <footer>&copy;2026 Xperi Inc. All Rights Reserved.</footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Extraordinary opportunities await.</p>
    <p>Through our brands &#8211; DTS&#174;, HD Radio&#8482;, IMAX&#174; Enhanced and TiVo&#174;</p>
    <div>Search Jobs</div>
    <div>View Openings</div>
    <div>Life @ Xperi</div>
  </body>
</html>
`

const locationsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div>Filter by Country Australia China India Ireland Japan Mexico Poland Singapore South Korea Sweden Taiwan United Kingdom United States</div>
    <div>Xperi Bangalore</div>
    <div>Bangalore, India 560103</div>
    <div>Xperi Pune</div>
    <div>Pune, Maharashtra, India 411014</div>
  </body>
</html>
`

test('TiVo India recognizes the current TiVo homepage and shared Xperi careers shell', async () => {
  const tivo = await loadModule()

  assert.equal(tivo.hasOfficialTiVoHomepageSignal(homepageHtml), true)
  assert.equal(tivo.hasSharedXperiCareersSignal(careersHtml), true)
  assert.equal(tivo.hasIndiaLocationsSignal(locationsHtml), true)
})

test('TiVo India returns no jobs while the shared-parent careers and locations pages remain the verified surfaces', async () => {
  const tivo = await loadModule()

  const jobs = await tivo.createTiVoIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === tivo.BRAND_HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }
      if (url === tivo.SHARED_CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }
      if (url === tivo.LOCATIONS_URL) {
        return { status: 200, url, html: locationsHtml }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
