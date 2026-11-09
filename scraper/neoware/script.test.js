import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en" class="h-full bg-neutral-950 text-base antialiased">
  <head>
    <title>NeoWare — NeoZip</title>
    <meta
      name="description"
      content="NeoWare builds next-generation data tools that combine archiving, blockchain authenticity and modern cryptography. Maker of NeoZip."
    />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/use-cases">Use Cases</a>
      <a href="/articles">Articles</a>
      <a href="/about">About</a>
      <a href="https://neozip.io">Try NeoZip →</a>
    </nav>
    <main>
      <h1>Trusted data, built for the next generation</h1>
      <p>
        NeoWare designs open source tools and standards that make digital files, and AI agents, secure and durable.
      </p>
      <h2>A foundation you can trust</h2>
      <p>Verifiable by design</p>
      <p>Built on standards</p>
      <p>Open and extensible</p>
      <h2>Our flagship product</h2>
      <p>NeoZip — Blockchain-secured Zip files</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en" class="h-full bg-neutral-950 text-base antialiased">
  <head>
    <title>NeoWare — NeoZip</title>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <p>Sorry, we couldn&#x27;t find the page you're looking for.</p>
      <a href="/">Go to the home page</a>
      <p>Looking for an article?</p>
      <a href="/articles">Browse all articles</a>
      <p>Building the next generation of trusted data infrastructure.</p>
      <footer>© 2026 NeoWare. All rights reserved. <a href="/privacy">Privacy Policy</a></footer>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Neoware sentinel recognizes the Monday, August 3, 2026 homepage and first-party missing-route shell', async () => {
  const neoware = await loadModule()
  assert.ok(neoware, 'Expected scraper module at ./script.js')

  assert.equal(neoware.SOURCE, 'neoware')
  assert.equal(neoware.COMPANY, 'Neoware')
  assert.equal(neoware.VERIFIED_ON, '2026-08-03')
  assert.equal(neoware.HOMEPAGE_URL, 'https://www.neoware.io/')
  assert.deepEqual(neoware.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.neoware.io/careers',
    'https://www.neoware.io/careers/',
    'https://www.neoware.io/career',
    'https://www.neoware.io/career/',
    'https://www.neoware.io/jobs',
    'https://www.neoware.io/jobs/',
    'https://www.neoware.io/openings',
    'https://www.neoware.io/openings/',
    'https://www.neoware.io/join-us',
    'https://www.neoware.io/join-us/',
    'https://www.neoware.io/sitemap.xml',
  ])

  assert.equal(neoware.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(neoware.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(neoware.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    neoware.isVerifiedMissingRoute({
      status: 404,
      url: 'https://www.neoware.io/careers',
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Neoware sentinel returns no jobs only while the verified NeoZip shell stays unchanged', async () => {
  const neoware = await loadModule()
  assert.ok(neoware, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await neoware.createNeowareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === neoware.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (neoware.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    neoware.HOMEPAGE_URL,
    ...neoware.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Neoware sentinel fails closed when the homepage or a checked route starts exposing careers content', async () => {
  const neoware = await loadModule()
  assert.ok(neoware, 'Expected scraper module at ./script.js')

  await assert.rejects(
    neoware.createNeowareScraper().run({
      fetchPage: async (url) => {
        if (url === neoware.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    neoware.createNeowareScraper().run({
      fetchPage: async (url) => {
        if (url === neoware.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers path/i,
  )

  await assert.rejects(
    neoware.createNeowareScraper().run({
      fetchPage: async (url) => {
        if (url === neoware.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === neoware.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p></body></html>',
          }
        }

        if (neoware.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party route changed or now exposes a public careers surface/i,
  )
})
