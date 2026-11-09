import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nectar Lifesciences Ltd. I Pharmaceutical Manufacturer India</title>
  </head>
  <body>
    <nav>
      <a href="https://www.neclife.com/careers">Careers</a>
    </nav>
    <main>
      <h1>Global Leader in Cephalosporin APIs</h1>
      <p>Incorporated in 1995, Nectar Lifesciences is a leading global manufacturer of cephalosporin antibiotics medicines, saving lives in over 45 countries.</p>
      <p>Nurturing, Enriching and Caring..</p>
    </main>
    <footer>&copy; 2022 Nectar Lifesciences Ltd.</footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | My Site</title>
  </head>
  <body>
    <nav>
      <a href="https://www.neclife.com">Home</a>
      <a href="https://www.neclife.com/search">Search Results</a>
      <a href="https://www.neclife.com/careers">Careers</a>
    </nav>
    <main>
      <p>Use tab to navigate through the menu items.</p>
    </main>
    <footer>
      <p>&copy; 2022 Nectar Lifesciences Ltd.</p>
      <a href="https://www.neclife.com/privacy-policy">Privacy Policy</a>
    </footer>
  </body>
</html>
`

const careersHtmlWithJobs = `
${careersHtml}
<section>
  <h2>Current Openings</h2>
  <a href="https://jobs.lever.co/nectarlifesciences">Apply now</a>
</section>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nectarlifesciences/script.js')
  } catch {
    assert.fail('Expected Nectar Lifesciences scraper module at ../../scraper/nectarlifesciences/script.js')
  }
}

test('Nectar Lifesciences sentinel stays pinned to the verified first-party homepage and careers shell', async () => {
  const nectar = await loadModule()

  assert.equal(nectar.SOURCE, 'nectarlifesciences')
  assert.equal(nectar.COMPANY, 'Nectar Lifesciences')
  assert.equal(nectar.OFFICIAL_BRAND_NAME, 'Nectar Lifesciences Ltd.')
  assert.equal(nectar.VERIFIED_ON, '2026-08-03')
  assert.equal(nectar.HOMEPAGE_URL, 'https://www.neclife.com/')
  assert.equal(nectar.CAREERS_URL, 'https://www.neclife.com/careers')
  assert.match(nectar.VERIFIED_SURFACE_SUMMARY, /no trustworthy public job listings/i)

  assert.equal(nectar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nectar.hasOfficialHomepageSignal('<html><body><h1>Nectar</h1></body></html>'), false)
  assert.equal(nectar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(nectar.hasOfficialCareersSignal('<html><body><h1>Jobs</h1></body></html>'), false)
  assert.equal(nectar.hasPublicJobsSignal(careersHtml), false)
  assert.equal(nectar.hasPublicJobsSignal(careersHtmlWithJobs), true)
})

test('Nectar Lifesciences returns [] only while the verified official careers page remains a shell without listings', async () => {
  const nectar = await loadModule()
  const requestedUrls = []

  const jobs = await nectar.createNectarLifesciencesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nectar.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === nectar.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected Nectar Lifesciences URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nectar.HOMEPAGE_URL,
    nectar.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Nectar Lifesciences fails closed when the verified surface drifts into public jobs', async () => {
  const nectar = await loadModule()

  await assert.rejects(
    nectar.createNectarLifesciencesScraper().run({
      fetchPage: async (url) => {
        if (url === nectar.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Homepage changed</h1></body></html>' }
        }

        throw new Error(`Unexpected Nectar Lifesciences URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    nectar.createNectarLifesciencesScraper().run({
      fetchPage: async (url) => {
        if (url === nectar.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === nectar.CAREERS_URL) {
          return { status: 200, url, html: careersHtmlWithJobs }
        }

        throw new Error(`Unexpected Nectar Lifesciences URL: ${url}`)
      },
    }),
    /public jobs/i,
  )
})
