import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Leading Aluminium Windows and Doors Manufacturer, Supplier Company | Tostem India</title>
    </head>
    <body>
      <main>
        <h1>Japanese Innovation in Window Design</h1>
        <a href="https://www.tostemindia.com/career/">Career</a>
      </main>
      <footer>
        <p>LIXIL WINDOW SYSTEM</p>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Tostem India Jobs Vacancy Recruitment, Career Portal for Fresher &amp; Experienced Job Opening</title>
    </head>
    <body>
      <main>
        <h1>Japanese Innovation in Window Design</h1>
        <nav>
          <a href="https://www.tostemindia.com/">Home</a>
          <a href="https://www.tostemindia.com/career/">Career</a>
        </nav>
      </main>
      <footer>
        <p>LIXIL WINDOW SYSTEM</p>
        <p>Email: support.lwsindia@lixil.com</p>
        <p>&copy; 2022-2025 TOSTEM India. All rights reserved.</p>
      </footer>
    </body>
  </html>
`

test('TOSTEM sentinel validates the verified homepage and first-party empty career stub', async () => {
  const tostem = await loadModule()
  assert.ok(tostem, 'TOSTEM scraper module should load')

  assert.equal(tostem.SOURCE, 'tostem')
  assert.equal(tostem.HOMEPAGE_URL, 'https://www.tostemindia.com/')
  assert.equal(tostem.CAREERS_URL, 'https://www.tostemindia.com/career/')
  assert.equal(tostem.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tostem.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(tostem.hasPublicJobsSignal(careersHtml), false)
})

test('TOSTEM sentinel returns no jobs while the verified first-party career surface remains a non-listing stub', async () => {
  const tostem = await loadModule()
  assert.ok(tostem, 'TOSTEM scraper module should load')

  const requestedUrls = []
  const jobs = await tostem.createTostemScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === tostem.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === tostem.CAREERS_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected TOSTEM URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.tostemindia.com/',
    'https://www.tostemindia.com/career/',
  ])
  assert.deepEqual(jobs, [])
})

test('TOSTEM default fetch is bounded by a timeout signal', async () => {
  const tostem = await loadModule()
  assert.ok(tostem, 'TOSTEM scraper module should load')

  let capturedInit = null
  const page = await tostem.defaultFetchPage(tostem.HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => homepageHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, tostem.HOMEPAGE_URL)
  assert.equal(page.html, homepageHtml)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('TOSTEM sentinel fails closed when the verified homepage or career stub drifts into a public jobs surface', async () => {
  const tostem = await loadModule()
  assert.ok(tostem, 'TOSTEM scraper module should load')

  await assert.rejects(
    tostem.createTostemScraper().run({
      fetchPage: async (url) => {
        if (url === tostem.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    tostem.createTostemScraper().run({
      fetchPage: async (url) => {
        if (url === tostem.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return { status: 200, url, html: '<html><body><h1>Open roles</h1></body></html>' }
      },
    }),
    /verified career stub/i,
  )

  await assert.rejects(
    tostem.createTostemScraper().run({
      fetchPage: async (url) => {
        if (url === tostem.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        return {
          status: 200,
          url,
          html: careersHtml.replace(
            '</main>',
            '<a href="https://jobs.example.com/tostem">Apply now</a></main>',
          ),
        }
      },
    }),
    /public jobs surface/i,
  )
})
