import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const parkedHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>gulfasia.com - This website is for sale! - gulfasia Resources and Information.</title>
      <meta
        name="description"
        content="This website is for sale! gulfasia.com is your first and best source for information about gulfasia. Here you will also find topics relating to issues of general interest. We hope you find what you are looking for!"
      />
      <link rel="icon" href="//img.sedoparking.com/templates/logos/sedo_logo.png" />
    </head>
    <body>
      <img src="https://img.sedoparking.com/images/js_preloader.gif" alt="" />
      <script src="https://euob.iseaskies.com/sxp/i/581749a3c1e7922374ca9b3d4dff0407.js"></script>
      <p>This website is for sale!</p>
    </body>
  </html>
`

test('Gulf Asia module loads and validates the verified parked no-jobs public surface', async () => {
  const gulfasia = await loadModule()
  assert.ok(gulfasia, 'Gulf Asia scraper module should load')

  const {
    HOMEPAGE_URL,
    CAREERS_URL,
    JOBS_URL,
    hasParkedDomainSignal,
    hasPublicJobBoardSignal,
    matchesVerifiedNoJobsSurface,
    validateJobResults,
  } = gulfasia

  assert.equal(HOMEPAGE_URL, 'https://gulfasia.com/')
  assert.equal(CAREERS_URL, 'https://gulfasia.com/careers')
  assert.equal(JOBS_URL, 'https://gulfasia.com/jobs')
  assert.equal(hasParkedDomainSignal(parkedHtml), true)
  assert.equal(hasPublicJobBoardSignal(parkedHtml), false)
  assert.equal(matchesVerifiedNoJobsSurface(parkedHtml, parkedHtml, parkedHtml), true)
  assert.deepEqual(validateJobResults([]), [])
})

test('Gulf Asia returns no jobs only while homepage, careers, and jobs routes all remain parked', async () => {
  const gulfasia = await loadModule()
  assert.ok(gulfasia, 'Gulf Asia scraper module should load')

  const requests = []
  const jobs = await gulfasia.createGulfAsiaScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      return parkedHtml
    },
  })

  assert.deepEqual(requests, [
    gulfasia.HOMEPAGE_URL,
    gulfasia.CAREERS_URL,
    gulfasia.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Gulf Asia fails closed when any route stops matching the verified parked no-jobs state', async () => {
  const gulfasia = await loadModule()
  assert.ok(gulfasia, 'Gulf Asia scraper module should load')

  await assert.rejects(
    gulfasia.createGulfAsiaScraper().run({
      fetchText: async (url) => {
        if (url === gulfasia.CAREERS_URL) {
          return `
            <html>
              <head><title>Careers at Gulf Asia</title></head>
              <body>
                <h1>Open Roles</h1>
                <a href="/jobs/mechanical-engineer">Apply now</a>
              </body>
            </html>
          `
        }

        return parkedHtml
      },
    }),
    /public careers surface now appears to expose job listings/i,
  )

  await assert.rejects(
    gulfasia.createGulfAsiaScraper().run({
      fetchText: async (url) => {
        if (url === gulfasia.HOMEPAGE_URL) {
          return `
            <html>
              <head><title>Gulf Asia</title></head>
              <body>
                <h1>Welcome to Gulf Asia</h1>
              </body>
            </html>
          `
        }

        return parkedHtml
      },
    }),
    /homepage no longer matches the verified parked public surface/i,
  )

  await assert.rejects(
    gulfasia.createGulfAsiaScraper().run({
      fetchText: async (url) => {
        if (url === gulfasia.JOBS_URL) {
          return `
            <html>
              <head><title>gulfasia.com - coming soon</title></head>
              <body>
                <p>Jobs page coming soon.</p>
              </body>
            </html>
          `
        }

        return parkedHtml
      },
    }),
    /public routes no longer match the verified parked no-jobs surface/i,
  )
})
