import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KreditBee</title>
  </head>
  <body>
    <div id="app"></div>
    <script defer src="/react/runtime-main.31a1b939d85abc3049a1.js"></script>
    <script defer src="/react/main.4c3987ab6f4e3d7b8891.js"></script>
  </body>
</html>
`

const detailShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KreditBee</title>
  </head>
  <body>
    <div id="app"></div>
    <script defer src="/react/runtime-main.31a1b939d85abc3049a1.js"></script>
    <script defer src="/react/main.4c3987ab6f4e3d7b8891.js"></script>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.kreditbee.in/careers</loc>
  </url>
  <url>
    <loc>https://www.kreditbee.in/about-us</loc>
  </url>
</urlset>
`

const sitemapWithDetailUrlsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.kreditbee.in/careers</loc>
  </url>
  <url>
    <loc>https://www.kreditbee.in/careers/data-engineer</loc>
  </url>
</urlset>
`

const trustworthyDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Data Engineer | KreditBee Careers</title>
  </head>
  <body>
    <main>
      <h1>Data Engineer</h1>
      <h2>Job Description</h2>
      <p>Build and maintain production data pipelines.</p>
      <h2>Job Requirements</h2>
      <p>Experience with distributed data systems.</p>
      <p>Need More Details?</p>
      <label>Position Applied</label>
    </main>
  </body>
</html>
`

const loadKreditBeeModule = async () => {
  try {
    return await import('../../scraper/kreditbee/script.js')
  } catch {
    assert.fail('Expected KreditBee scraper module at ../../scraper/kreditbee/script.js')
  }
}

test('KreditBee pins the verified careers shell, sitemap, and non-verifiable detail-route signals', async () => {
  const kreditbee = await loadKreditBeeModule()

  assert.equal(kreditbee.SOURCE, 'kreditbee')
  assert.equal(kreditbee.COMPANY_NAME, 'KreditBee')
  assert.equal(kreditbee.CAREERS_URL, 'https://www.kreditbee.in/careers')
  assert.equal(kreditbee.SITEMAP_URL, 'https://www.kreditbee.in/sitemap.xml')
  assert.deepEqual(kreditbee.VERIFIED_DETAIL_PROBE_URLS, [
    'https://www.kreditbee.in/careers/data-engineer',
    'https://www.kreditbee.in/careers/Team-Lead',
  ])
  assert.equal(kreditbee.VERIFIED_ON, '2026-07-16')
  assert.equal(kreditbee.hasVerifiedCareersShellSignal(careersShellHtml), true)
  assert.deepEqual(kreditbee.extractCareerUrlsFromSitemap(sitemapXml), [
    'https://www.kreditbee.in/careers',
  ])
  assert.equal(kreditbee.hasVerifiedSitemapShape(sitemapXml), true)
  assert.equal(kreditbee.hasTrustworthyPublicJobDetailSignal(detailShellHtml), false)
  assert.equal(kreditbee.hasNonVerifiableDetailShell(detailShellHtml), true)
  assert.equal(kreditbee.hasTrustworthyPublicJobDetailSignal(trustworthyDetailHtml), true)
})

test('KreditBee returns [] while the official careers surface remains non-verifiable', async () => {
  const kreditbee = await loadKreditBeeModule()
  const requestedUrls = []

  const jobs = await kreditbee.createKreditBeeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kreditbee.CAREERS_URL) return careersShellHtml
      if (url === kreditbee.SITEMAP_URL) return sitemapXml
      if (kreditbee.VERIFIED_DETAIL_PROBE_URLS.includes(url)) return detailShellHtml

      throw new Error(`Unexpected KreditBee fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kreditbee.CAREERS_URL,
    kreditbee.SITEMAP_URL,
    'https://www.kreditbee.in/careers/data-engineer',
    'https://www.kreditbee.in/careers/Team-Lead',
  ])
  assert.deepEqual(jobs, [])
})

test('KreditBee fails closed when the first-party surface becomes a trustworthy public jobs contract', async () => {
  const kreditbee = await loadKreditBeeModule()

  await assert.rejects(
    kreditbee.createKreditBeeScraper().run({
      fetchText: async (url) => {
        if (url === kreditbee.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        if (url === kreditbee.SITEMAP_URL) return sitemapXml
        if (kreditbee.VERIFIED_DETAIL_PROBE_URLS.includes(url)) return detailShellHtml
        throw new Error(`Unexpected KreditBee fixture URL: ${url}`)
      },
    }),
    /careers shell/i,
  )

  await assert.rejects(
    kreditbee.createKreditBeeScraper().run({
      fetchText: async (url) => {
        if (url === kreditbee.CAREERS_URL) return careersShellHtml
        if (url === kreditbee.SITEMAP_URL) return sitemapWithDetailUrlsXml
        if (kreditbee.VERIFIED_DETAIL_PROBE_URLS.includes(url)) return detailShellHtml
        throw new Error(`Unexpected KreditBee fixture URL: ${url}`)
      },
    }),
    /sitemap now exposes public career detail urls/i,
  )

  await assert.rejects(
    kreditbee.createKreditBeeScraper().run({
      fetchText: async (url) => {
        if (url === kreditbee.CAREERS_URL) return careersShellHtml
        if (url === kreditbee.SITEMAP_URL) return sitemapXml
        if (url === 'https://www.kreditbee.in/careers/data-engineer') return trustworthyDetailHtml
        if (url === 'https://www.kreditbee.in/careers/Team-Lead') return detailShellHtml
        throw new Error(`Unexpected KreditBee fixture URL: ${url}`)
      },
    }),
    /detail route now exposes trustworthy public job content/i,
  )
})
