import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Industrial Forklift Manufacturer | Diesel &amp; Electric Forklifts | HUAYA</title>
    <link rel="canonical" href="https://www.huayaba.com/" />
  </head>
  <body>
    <section>
      <h2>Hebei Huaya Co., Ltd.</h2>
      <p>HUAYA was founded in 1996.</p>
      <p>Email: info@huaya.cn</p>
    </section>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ABOUT HUAYA</title>
    <link rel="canonical" href="https://www.huayaba.com/about/" />
  </head>
  <body>
    <section>
      <h2>Company Profile</h2>
      <h3>Hebei Huaya Co., Ltd.</h3>
      <p>HUAYA has established after-sales service networks in multiple regions worldwide.</p>
      <p>HUAYA was founded in 1996.</p>
    </section>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.huayaba.com/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.huayaba.com/page-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/careers/process-engineer">Current Openings</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Process Engineer" }
    </script>
  </body>
</html>
`

const sitemapWithJobsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.huayaba.com/careers-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const loadHuayaModule = async () => {
  try {
    return await import('../../scraper/huaya/script.js')
  } catch {
    assert.fail('Expected Huaya scraper module at ../../scraper/huaya/script.js')
  }
}

test('Huaya sentinel constants stay pinned to the verified homepage, about page, and sitemap surfaces', async () => {
  const huaya = await loadHuayaModule()

  assert.equal(huaya.SOURCE, 'huaya')
  assert.equal(huaya.COMPANY_NAME, 'Huaya')
  assert.equal(huaya.OFFICIAL_BRAND_NAME, 'Hebei Huaya Co., Ltd.')
  assert.equal(huaya.HOMEPAGE_URL, 'https://www.huayaba.com/')
  assert.equal(huaya.ABOUT_PAGE_URL, 'https://www.huayaba.com/about/')
  assert.equal(huaya.SITEMAP_URL, 'https://www.huayaba.com/sitemap_index.xml')
  assert.equal(huaya.VERIFIED_ON, '2026-07-16')
  assert.equal(huaya.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(huaya.hasVerifiedAboutPageSignal(aboutHtml), true)
  assert.equal(huaya.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(huaya.hasPublicJobSignals(homepageHtml), false)
  assert.equal(huaya.hasPublicJobSignals(aboutHtml), false)
  assert.equal(huaya.hasPublicJobSignals(sitemapXml), false)
  assert.equal(huaya.hasPublicJobSignals(publicJobsHtml), true)
})

test('Huaya returns [] only while the verified official surfaces remain jobless first-party marketing pages', async () => {
  const huaya = await loadHuayaModule()
  const requestedUrls = []

  const jobs = await huaya.createHuayaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === huaya.HOMEPAGE_URL) return homepageHtml
      if (url === huaya.ABOUT_PAGE_URL) return aboutHtml
      if (url === huaya.SITEMAP_URL) return sitemapXml
      throw new Error(`Unexpected Huaya URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.huayaba.com/',
    'https://www.huayaba.com/about/',
    'https://www.huayaba.com/sitemap_index.xml',
  ])
  assert.deepEqual(jobs, [])
})

test('Huaya fails closed when the verified homepage, about page, or sitemap drift into a public jobs surface', async () => {
  const huaya = await loadHuayaModule()

  await assert.rejects(
    huaya.createHuayaScraper().run({
      fetchText: async (url) => {
        if (url === huaya.HOMEPAGE_URL) {
          return homepageHtml.replace('Hebei Huaya Co., Ltd.', 'Different Company')
        }
        throw new Error(`Unexpected Huaya URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    huaya.createHuayaScraper().run({
      fetchText: async (url) => {
        if (url === huaya.HOMEPAGE_URL) return homepageHtml
        if (url === huaya.ABOUT_PAGE_URL) return publicJobsHtml
        if (url === huaya.SITEMAP_URL) return sitemapXml
        throw new Error(`Unexpected Huaya URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    huaya.createHuayaScraper().run({
      fetchText: async (url) => {
        if (url === huaya.HOMEPAGE_URL) return homepageHtml
        if (url === huaya.ABOUT_PAGE_URL) return aboutHtml
        if (url === huaya.SITEMAP_URL) return sitemapWithJobsXml
        throw new Error(`Unexpected Huaya URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
