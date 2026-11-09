import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Atain | Grow, Innovate and Create Real Impact</title>
    <link rel="canonical" href="https://atain.com/careers/">
  </head>
  <body>
    <main>
      <p>IGT Solutions Rebrands as Atain</p>
      <a href="https://atain.com/join-the-squad/">Join the Squad</a>
    </main>
  </body>
</html>
`

const joinSquadHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join the Squad</h1>
      <p>Upload Resume</p>
      <a href="mailto:Accommodations@atain.com">Accommodations@atain.com</a>
    </main>
  </body>
</html>
`

const sapLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Recruiting Software &amp; ATS</title>
  </head>
  <body>
    <main>
      <h1>SmartRecruiters for SAP SuccessFactors</h1>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/igtsolutions/script.js')
  } catch {
    assert.fail('Expected IGT Solutions scraper module at ../../scraper/igtsolutions/script.js')
  }
}

test('IGT Solutions falls back to a browser-backed page loader when Node fetch times out', async () => {
  const igtSolutions = await loadModule()
  const requestedPrimaryUrls = []
  const requestedBrowserUrls = []

  const jobs = await igtSolutions.createIgtSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new Error(`Request timed out after 15000ms for ${url}`)
    },
    fetchBrowserPage: async (url) => {
      requestedBrowserUrls.push(url)

      if (url === igtSolutions.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === igtSolutions.JOIN_SQUAD_URL) {
        return { status: 200, url, html: joinSquadHtml }
      }

      if (url === igtSolutions.LEGACY_BOARD_URLS[0]) {
        return { status: 403, url, html: '<html><body>Forbidden</body></html>' }
      }

      if (url === igtSolutions.LEGACY_BOARD_URLS[1]) {
        return {
          status: 200,
          url: 'https://www.sap.com/products/hcm/recruiting-software.html',
          html: sapLandingHtml,
        }
      }

      throw new Error(`Unexpected browser URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [
    igtSolutions.CAREERS_URL,
    igtSolutions.JOIN_SQUAD_URL,
    ...igtSolutions.LEGACY_BOARD_URLS,
  ])
  assert.deepEqual(requestedBrowserUrls, requestedPrimaryUrls)
  assert.deepEqual(jobs, [])
})
