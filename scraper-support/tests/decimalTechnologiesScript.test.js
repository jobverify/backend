import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <body>
      <h1>AI Platform for</h1>
      <h2>Intelligent Banking</h2>
    </body>
  </html>
`

const robotsTxt = `
User-agent: *
Allow: /
Sitemap: https://decimaltech.com/sitemap.xml
`

const sitemapXml = `
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://decimaltech.com/</loc></url>
    <url><loc>https://decimaltech.com/company/culture-and-values</loc></url>
  </urlset>
`

test('Decimal Technologies verifies its no-public-careers homepage, robots, and sitemap state', async () => {
  const decimal = await import('../../scraper/decimaltechnologies/script.js')

  assert.equal(decimal.hasExpectedHomepageSignal(homepageHtml), true)
  assert.equal(decimal.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.equal(decimal.sitemapExposesCareerUrls(sitemapXml), false)
  assert.deepEqual(decimal.extractSitemapUrls(sitemapXml), [
    'https://decimaltech.com/',
    'https://decimaltech.com/company/culture-and-values',
  ])
})

test('Decimal Technologies stays fail-closed while common careers routes remain absent', async () => {
  const decimal = await import('../../scraper/decimaltechnologies/script.js')
  const requested = []

  const jobs = await decimal.createDecimalTechnologiesScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === decimal.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === decimal.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
      if (url === decimal.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      return { status: 404, url, html: '<html><body>404</body></html>' }
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(requested.length, 8)
})
