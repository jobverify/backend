import assert from 'node:assert/strict'
import test from 'node:test'

const loadAstraEdaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstraEDA</title>
    <link rel="icon" type="image/png" href="https://i.ibb.co/pvCZmqqH/astra-logo.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <nav></nav>
    <main>
      <h1>AI-Powered Optimization for</h1>
      <h2>Superior Low-Power PPA</h2>
      <p>Supercharge your low-power design—10× faster with our custom recipe.</p>
      <p>Coming soon ...</p>
    </main>
  </body>
</html>
`

const verifiedRouteFallbackHtml = officialHomepageHtml

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>AstraEDA Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers at AstraEDA</h1>
      <p>We are hiring for multiple roles.</p>
      <a href="https://jobs.lever.co/astraeda/physical-design-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('AstraEDA sentinel recognizes the verified homepage shell and first-party route fallback shell', async () => {
  const astraEda = await loadAstraEdaModule()
  assert.ok(astraEda, 'Expected AstraEDA scraper module at ./script.js')

  assert.equal(astraEda.SOURCE, 'astraedapvtltd')
  assert.equal(astraEda.COMPANY, 'AstraEDA Pvt Ltd')
  assert.equal(astraEda.HOMEPAGE_URL, 'https://astraeda.com/')
  assert.deepEqual(astraEda.CHECKED_ROUTE_URLS, [
    'https://astraeda.com/careers',
    'https://astraeda.com/careers/',
    'https://astraeda.com/career',
    'https://astraeda.com/career/',
    'https://astraeda.com/jobs',
    'https://astraeda.com/jobs/',
    'https://astraeda.com/join-us',
    'https://astraeda.com/join-us/',
    'https://astraeda.com/openings',
    'https://astraeda.com/openings/',
  ])
  assert.equal(astraEda.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(astraEda.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    astraEda.isVerifiedRouteFallbackShell(verifiedRouteFallbackHtml, officialHomepageHtml),
    true,
  )
})

test('AstraEDA sentinel returns no jobs while the verified first-party route fallbacks stay on the homepage shell', async () => {
  const astraEda = await loadAstraEdaModule()
  assert.ok(astraEda, 'Expected AstraEDA scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await astraEda.createAstraEdaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === astraEda.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (astraEda.CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: verifiedRouteFallbackHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    astraEda.HOMEPAGE_URL,
    ...astraEda.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('AstraEDA sentinel fails closed when the homepage or a checked route starts exposing public jobs', async () => {
  const astraEda = await loadAstraEdaModule()
  assert.ok(astraEda, 'Expected AstraEDA scraper module at ./script.js')

  await assert.rejects(
    astraEda.createAstraEdaScraper().run({
      fetchPage: async (url) => {
        if (url === astraEda.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body><main>Unexpected</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    astraEda.createAstraEdaScraper().run({
      fetchPage: async (url) => {
        if (url === astraEda.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === astraEda.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        if (astraEda.CHECKED_ROUTE_URLS.slice(1).includes(url)) {
          return {
            status: 200,
            url,
            html: verifiedRouteFallbackHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
