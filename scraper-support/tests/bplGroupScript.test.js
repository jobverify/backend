import assert from 'node:assert/strict'
import test from 'node:test'

const loadBplGroupModule = async () => {
  try {
    return await import('../../scraper/bplgroup/script.js')
  } catch {
    assert.fail('Expected BPL Group scraper module at ../../scraper/bplgroup/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BPL: Buy Electronics Products</title>
  </head>
  <body>
    <main>
      <h1>BPL</h1>
      <p>Air conditioners, refrigerators, washing machines, and electronics.</p>
    </main>
  </body>
</html>
`

const notFoundRouteHtml = `
<!doctype html>
<html lang="en">
  <head><title>BPL</title></head>
  <body>
    <nav>TV &amp; Audio AC &amp; Coolers Refrigerators Washing Machines</nav>
    <main>BPL electronics product catalogue</main>
  </body>
</html>
`

test('BPL Group verifies the official homepage and empty careers routes', async () => {
  const bplgroup = await loadBplGroupModule()

  const jobs = await bplgroup.createBplGroupScraper().run({
    fetchPage: async (url) => {
      if (url === bplgroup.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      return { status: 200, url, html: notFoundRouteHtml }
    },
  })

  assert.equal(bplgroup.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bplgroup.isVerifiedNoPublicJobsRoute({ url: 'https://www.bpl.in/careers', html: notFoundRouteHtml }), true)
  assert.deepEqual(jobs, [])
})

test('BPL Group fails closed when a careers route becomes a real public jobs page', async () => {
  const bplgroup = await loadBplGroupModule()

  await assert.rejects(
    bplgroup.createBplGroupScraper().run({
      fetchPage: async (url) => {
        if (url === bplgroup.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Current Openings</h1><a href="/jobs/1">Apply now</a></body></html>',
        }
      },
    }),
    /BPL Group careers routes changed materially/i,
  )
})
