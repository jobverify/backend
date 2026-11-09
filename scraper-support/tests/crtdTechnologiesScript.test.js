import assert from 'node:assert/strict'
import test from 'node:test'

const loadCrtdModule = async () => import('../../scraper/crtdtechnologies/script.js')

test('CRTD accepts the canonical www shell title', async () => {
  const crtd = await loadCrtdModule()

  const homepageHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>CRTD Technologies | IT Solutions &amp; Software Development</title>
        <script type="module" crossorigin src="/assets/index-C-bvqXK2.js"></script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `

  assert.equal(crtd.hasOfficialShellSignal(homepageHtml), true)
})

test('CRTD returns [] when the canonical site is live and the old careers route plus APIs are 404', async () => {
  const crtd = await loadCrtdModule()

  const homepageHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>CRTD Technologies | IT Solutions &amp; Software Development</title>
        <script type="module" crossorigin src="/assets/index-C-bvqXK2.js"></script>
      </head>
      <body>
        <div id="root"></div>
        <main>
          <h1>Trusted Software Solutions Partner</h1>
          <p>Building the Future with Smart Software</p>
        </main>
      </body>
    </html>
  `

  const jobs = await crtd.createCrtdTechnologiesScraper().run({
    fetchPage: async (url) => {
      if (url === crtd.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === crtd.CAREERS_URL) {
        return { status: 404, url, html: '<title>404: NOT_FOUND</title>' }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchStatus: async (url) => {
      if (url === crtd.API_JOBS_URL || url === crtd.API_STATS_URL) {
        return 404
      }

      throw new Error(`Unexpected status URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
