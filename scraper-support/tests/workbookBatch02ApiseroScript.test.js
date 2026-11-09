import assert from 'node:assert/strict'
import test from 'node:test'

const PARENT_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us</title>
  </head>
  <body>
    <header>
      <a href="/en-us/about-us">About us</a>
      <a href="/en-us/careers">Careers</a>
      <a href="/en-us/newsroom">Newsroom</a>
    </header>
    <main>
      <h1>About us</h1>
      <p>NTT DATA</p>
      <p>We offer business and technology services, from consulting to connectivity, serving clients and industries around the world.</p>
      <section>
        <h2>What we do</h2>
        <p>We use technology to accelerate client success and positively impact society through responsible innovation.</p>
      </section>
      <section>
        <h2>Who we are</h2>
        <p>Learn more about NTT DATA and the leadership team guiding the company.</p>
      </section>
      <a href="/en-us/careers">See career opportunities</a>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article>
      <h2>Senior MuleSoft Engineer</h2>
      <p>Bengaluru, India</p>
      <a href="https://jobs.example.com/apisero-senior-mulesoft-engineer">Apply Now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/apisero/script.js')
  } catch {
    assert.fail('Expected APISero scraper module at ../../scraper/apisero/script.js')
  }
}

test('APISero helper signals stay pinned to the verified parent-company redirect surface from Thursday, July 30, 2026', async () => {
  const apisero = await loadModule()

  assert.equal(apisero.SOURCE, 'apisero')
  assert.equal(apisero.COMPANY, 'APISero')
  assert.equal(apisero.VERIFIED_ON, '2026-07-30')
  assert.equal(apisero.HOMEPAGE_URL, 'https://apisero.com/')
  assert.equal(apisero.CAREERS_URL, 'https://apisero.com/careers')
  assert.equal(apisero.JOBS_URL, 'https://apisero.com/jobs')
  assert.equal(apisero.ABOUT_URL, 'https://apisero.com/about-us/')
  assert.equal(apisero.PARENT_ABOUT_URL, 'https://www.nttdata.com/en-us/about-us/')
  assert.equal(apisero.hasParentAboutPageSignal(PARENT_ABOUT_HTML), true)
  assert.equal(apisero.pageExposesExactPublicJobListings(PARENT_ABOUT_HTML), false)
  assert.equal(apisero.pageExposesExactPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    apisero.isVerifiedParentRedirectPage(
      {
        status: 200,
        url: apisero.PARENT_ABOUT_URL,
        html: PARENT_ABOUT_HTML,
      },
      apisero.PARENT_ABOUT_URL,
    ),
    true,
  )
})

test('APISero returns [] only while the verified exact-name routes all redirect to the same parent about page', async () => {
  const apisero = await loadModule()
  const requestedUrls = []

  const jobs = await apisero.createApiseroScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === apisero.HOMEPAGE_URL
        || url === apisero.CAREERS_URL
        || url === apisero.JOBS_URL
        || url === apisero.ABOUT_URL
      ) {
        return {
          status: 200,
          url: apisero.PARENT_ABOUT_URL,
          html: PARENT_ABOUT_HTML,
        }
      }

      throw new Error(`Unexpected APISero URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    apisero.HOMEPAGE_URL,
    apisero.CAREERS_URL,
    apisero.JOBS_URL,
    apisero.ABOUT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('APISero fails closed when the verified redirect contract changes materially', async () => {
  const apisero = await loadModule()

  await assert.rejects(
    apisero.createApiseroScraper().run({
      fetchPage: async (url) => {
        if (url === apisero.HOMEPAGE_URL) {
          return { status: 200, url: apisero.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === apisero.CAREERS_URL || url === apisero.JOBS_URL || url === apisero.ABOUT_URL) {
          return { status: 200, url: apisero.PARENT_ABOUT_URL, html: PARENT_ABOUT_HTML }
        }

        throw new Error(`Unexpected APISero URL: ${url}`)
      },
    }),
    /homepage route for apisero/i,
  )

  await assert.rejects(
    apisero.createApiseroScraper().run({
      fetchPage: async (url) => {
        if (url === apisero.HOMEPAGE_URL || url === apisero.CAREERS_URL || url === apisero.ABOUT_URL) {
          return { status: 200, url: apisero.PARENT_ABOUT_URL, html: PARENT_ABOUT_HTML }
        }

        if (url === apisero.JOBS_URL) {
          return { status: 200, url: apisero.PARENT_ABOUT_URL, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected APISero URL: ${url}`)
      },
    }),
    /jobs route for apisero/i,
  )
})

test('APISero recognizes the current branded parent redirect while rejecting an unrelated canonical or a lost hero', async () => {
  const { readFile } = await import('node:fs/promises')
  const apisero = await loadModule()
  const html = await readFile(new URL('./fixtures/apisero/ntt-parent-about-20261009.html', import.meta.url), 'utf8')
  assert.equal(apisero.hasParentAboutPageSignal(html), true)
  assert.equal(apisero.hasParentAboutPageSignal(html.replaceAll('https://www.nttdata.com/en-us/about-us', 'https://example.com/about-us')), false)
  assert.equal(apisero.hasParentAboutPageSignal(html.replaceAll('Intelligence to Impact', 'Unrelated hero')), false)
  const urls = []
  assert.deepEqual(await apisero.run({ fetchPage: async url => { urls.push(url); return { status: 200, url: 'https://www.nttdata.com/en-us/about-us', html } } }), [])
  assert.equal(urls.length, 4)
})
