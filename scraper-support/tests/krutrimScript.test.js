import assert from 'node:assert/strict'
import test from 'node:test'

const loadKrutrimModule = async () => {
  try {
    return await import('../../scraper/krutrim/script.js')
  } catch {
    assert.fail('Expected Krutrim scraper module at ../../scraper/krutrim/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Krutrim Cloud</title>
  </head>
  <body>
    <nav>
      <a href="/products">Products</a>
      <a href="/pricing">Pricing</a>
      <a href="/docs">Docs</a>
      <a href="/contact">Contact Us</a>
      <a href="/login">Login</a>
      <a href="/register">Register</a>
    </nav>
    <main>
      <h1>Build on Krutrim Cloud</h1>
    </main>
  </body>
</html>
`

const aiLabsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Krutrim AI Labs</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/#blogs">Blog</a>
      <a href="/#opensource">Opensource</a>
      <a href="/publication">Publications</a>
    </nav>
    <main>
      <h1>India's Frontier AI Research Lab</h1>
      <section>
        <h2>Join Us</h2>
        <p>Are you passionate about artificial intelligence?</p>
        <h3>Career Opportunities</h3>
        <p>Join a community of forward-thinking pioneers shaping tomorrow's world - today.</p>
        <button type="button">Open Positions</button>
      </section>
      <section>
        <h3>Experience the Future of AI with Krutrim AI Labs</h3>
        <button type="button">Contact Us</button>
      </section>
    </main>
  </body>
</html>
`

const jobsLinkedAiLabsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Krutrim AI Labs</title>
  </head>
  <body>
    <main>
      <h1>India's Frontier AI Research Lab</h1>
      <section>
        <h2>Join Us</h2>
        <a href="https://ai-labs.olakrutrim.com/careers">Open Positions</a>
      </section>
    </main>
  </body>
</html>
`

const mainSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.olakrutrim.com/</loc></url>
  <url><loc>https://www.olakrutrim.com/ai-cloud</loc></url>
  <url><loc>https://www.olakrutrim.com/ai-studio</loc></url>
  <url><loc>https://www.olakrutrim.com/gpu-services</loc></url>
  <url><loc>https://www.olakrutrim.com/language-hub</loc></url>
</urlset>
`

const sitemapWithCareersXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.olakrutrim.com/</loc></url>
  <url><loc>https://ai-labs.olakrutrim.com/careers</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404: This page could not be found.</title>
  </head>
  <body>
    <h1>404</h1>
    <h2>This page could not be found.</h2>
  </body>
</html>
`

const driftedAiLabsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No Join Us contract here.</p></main>
  </body>
</html>
`

test('Krutrim pins the verified first-party homepage, AI Labs shell, and no-public-jobs signals', async () => {
  const krutrim = await loadKrutrimModule()

  assert.equal(krutrim.SOURCE, 'krutrim')
  assert.equal(krutrim.COMPANY, 'Krutrim')
  assert.equal(krutrim.VERIFIED_ON, '2026-07-16')
  assert.equal(krutrim.HOMEPAGE_URL, 'https://www.olakrutrim.com/')
  assert.equal(krutrim.CAREERS_URL, 'https://ai-labs.olakrutrim.com/')

  assert.equal(krutrim.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(krutrim.hasVerifiedAiLabsSignal(aiLabsHtml), true)
  assert.equal(krutrim.hasVisiblePublicJobsSignal(aiLabsHtml), false)
  assert.equal(krutrim.hasVisiblePublicJobsSignal(jobsLinkedAiLabsHtml), true)
  assert.equal(krutrim.sitemapHasNoPublicCareerUrls(mainSitemapXml), true)
  assert.equal(
    krutrim.isFirstPartyNotFoundPage({ status: 404, html: notFoundHtml }),
    true,
  )
})

test('Krutrim sentinel returns [] only while the official first-party surface stays non-crawlable for jobs', async () => {
  const krutrim = await loadKrutrimModule()
  const requestedUrls = []

  const jobs = await krutrim.createKrutrimScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === krutrim.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === krutrim.CAREERS_URL) {
        return { status: 200, url, html: aiLabsHtml }
      }

      if (url === krutrim.MAIN_SITEMAP_URL) {
        return { status: 200, url, html: mainSitemapXml }
      }

      if (url === krutrim.AI_LABS_CAREERS_URL || url === krutrim.AI_LABS_SITEMAP_URL) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    krutrim.HOMEPAGE_URL,
    krutrim.CAREERS_URL,
    krutrim.MAIN_SITEMAP_URL,
    krutrim.AI_LABS_CAREERS_URL,
    krutrim.AI_LABS_SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Krutrim sentinel fails closed when the AI Labs shell drifts or a public jobs route appears', async () => {
  const krutrim = await loadKrutrimModule()

  await assert.rejects(
    krutrim.createKrutrimScraper().run({
      fetchPage: async (url) => {
        if (url === krutrim.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === krutrim.CAREERS_URL) return { status: 200, url, html: driftedAiLabsHtml }
        if (url === krutrim.MAIN_SITEMAP_URL) return { status: 200, url, html: mainSitemapXml }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /ai labs/i,
  )

  await assert.rejects(
    krutrim.createKrutrimScraper().run({
      fetchPage: async (url) => {
        if (url === krutrim.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === krutrim.CAREERS_URL) return { status: 200, url, html: jobsLinkedAiLabsHtml }
        if (url === krutrim.MAIN_SITEMAP_URL) return { status: 200, url, html: mainSitemapXml }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    krutrim.createKrutrimScraper().run({
      fetchPage: async (url) => {
        if (url === krutrim.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === krutrim.CAREERS_URL) return { status: 200, url, html: aiLabsHtml }
        if (url === krutrim.MAIN_SITEMAP_URL) return { status: 200, url, html: sitemapWithCareersXml }
        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /public jobs surface/i,
  )
})
