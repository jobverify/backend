import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected ZAi-Fi Business Solutions scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ZAi-Fi | AI Solutions for Business &amp; Manufacturing</title>
    <meta name="description" content="ZAi-Fi builds custom AI agents, chatbots, and automation tools for manufacturing, sales, and operations teams. Based in Chennai — serving Southeast Asia." />
    <link rel="canonical" href="https://zaifi.co" />
  </head>
  <body>
    <nav>
      <a href="#home">Home</a>
      <a href="#services">Services</a>
      <a href="/blog">Blogs</a>
      <a href="#footer">Contact</a>
    </nav>
    <main>
      <h1>AI That Solves Real Business Problems</h1>
      <p>Transform your business with cutting-edge AI solutions designed to automate, optimize, and accelerate growth.</p>
      <a href="mailto:contact@zai-fi.com">contact@zai-fi.com</a>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HOME INTELLIGENCE — One Home. One AI. Every Room.</title>
    <meta name="description" content="A distributed Home AI system. Central Home AI Hub + Lightweight Voice Nodes. The AI follows the user, not the device." />
    <meta name="publisher" content="ZAi-Fi" />
    <link rel="canonical" href="https://zaifi.co" />
  </head>
  <body><a href="mailto:contact@zai-fi.com">contact@zai-fi.com</a></body>
</html>
`

const robotsTxt = `
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /_next/

Host: https://zaifi.co
Sitemap: https://zaifi.co/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://zaifi.co</loc></url>
  <url><loc>https://zaifi.co/about</loc></url>
  <url><loc>https://zaifi.co/services</loc></url>
  <url><loc>https://zaifi.co/blog</loc></url>
  <url><loc>https://zaifi.co/faq</loc></url>
  <url><loc>https://zaifi.co/contact</loc></url>
  <url><loc>https://zaifi.co/vision</loc></url>
  <url><loc>https://zaifi.co/blog/ai-manufacturing</loc></url>
  <url><loc>https://zaifi.co/projects/inzighted</loc></url>
</urlset>
`

test('ZAi-Fi Business Solutions sentinel pins the verified first-party no-careers surfaces', async () => {
  const zaifi = await loadModule()

  assert.equal(zaifi.SOURCE, 'zaifibusinesssolutions')
  assert.equal(zaifi.COMPANY, 'ZAi-Fi Business Solutions')
  assert.equal(zaifi.VERIFIED_ON, '2026-09-03')
  assert.equal(zaifi.FIRST_PARTY_ROOT_URL, 'https://zai-fi.com')
  assert.equal(zaifi.HOMEPAGE_URL, 'https://zai-fi.com/')
  assert.equal(zaifi.ROBOTS_URL, 'https://zai-fi.com/robots.txt')
  assert.equal(zaifi.SITEMAP_URL, 'https://zai-fi.com/sitemap.xml')
  assert.deepEqual(zaifi.CAREER_PATHS, [
    '/career',
    '/careers',
    '/jobs',
    '/join-us',
    '/work-with-us',
    '/openings',
  ])
  assert.equal(
    zaifi.VERIFIED_SURFACE_SUMMARY,
    'Verified the public ZAi-Fi site at https://zai-fi.com on September 3, 2026. Its current Home Intelligence homepage, robots.txt, and sitemap expose no careers route, and common careers URLs return 404.',
  )
  assert.equal(zaifi.isVerifiedHomepage(homepageHtml), true)
  assert.equal(zaifi.isVerifiedHomepage(currentHomepageHtml), true)
  assert.equal(zaifi.sitemapHasCareerRoutes(sitemapXml), false)
})

test('ZAi-Fi Business Solutions sentinel returns [] only while the verified no-careers contract holds', async () => {
  const zaifi = await loadModule()
  const requestedTexts = []
  const requestedStatuses = []

  const jobs = await zaifi.createZaifiBusinessSolutionsScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === zaifi.HOMEPAGE_URL) return homepageHtml
      if (url === zaifi.ROBOTS_URL) return robotsTxt
      if (url === zaifi.SITEMAP_URL) return sitemapXml
      throw new Error(`Unexpected text fixture URL: ${url}`)
    },
    fetchStatus: async (url) => {
      requestedStatuses.push(url)
      return 404
    },
  })

  assert.deepEqual(requestedTexts, [
    zaifi.HOMEPAGE_URL,
    zaifi.ROBOTS_URL,
    zaifi.SITEMAP_URL,
  ])
  assert.deepEqual(requestedStatuses, zaifi.buildCandidateCareerUrls())
  assert.deepEqual(jobs, [])
})

test('ZAi-Fi Business Solutions sentinel fails closed when the sitemap starts advertising a careers route', async () => {
  const zaifi = await loadModule()

  await assert.rejects(
    zaifi.createZaifiBusinessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === zaifi.HOMEPAGE_URL) return homepageHtml
        if (url === zaifi.ROBOTS_URL) return robotsTxt
        if (url === zaifi.SITEMAP_URL) {
          return `${sitemapXml.replace('</urlset>', '  <url><loc>https://zaifi.co/careers</loc></url>\n</urlset>')}`
        }
        throw new Error(`Unexpected text fixture URL: ${url}`)
      },
      fetchStatus: async () => 404,
    }),
    /public sitemap now exposes a careers-like route/i,
  )
})

test('ZAi-Fi Business Solutions sentinel fails closed when a common careers path stops returning 404', async () => {
  const zaifi = await loadModule()

  await assert.rejects(
    zaifi.createZaifiBusinessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === zaifi.HOMEPAGE_URL) return homepageHtml
        if (url === zaifi.ROBOTS_URL) return robotsTxt
        if (url === zaifi.SITEMAP_URL) return sitemapXml
        throw new Error(`Unexpected text fixture URL: ${url}`)
      },
      fetchStatus: async (url) => (url.endsWith('/careers') ? 200 : 404),
    }),
    /common careers path no longer returns 404/i,
  )
})


const engineeringHome = "<html><head><title>ZAi-Fi | Legacy Engineering Drawings to Editable CAD</title><meta name=\"description\" content=\"Convert scanned, handwritten and legacy engineering drawings into reviewed, editable 2D CAD. Discuss a sample drawing with our team.\"><link rel=\"canonical\" href=\"https://www.zai-fi.com\"><script type=\"application/ld+json\">{\"@type\":\"Organization\",\"name\":\"ZAIFI BUSINESS SOLUTIONS PRIVATE LIMITED\",\"alternateName\":\"ZAi-Fi\",\"url\":\"https://www.zai-fi.com\",\"contactPoint\":{\"email\":\"contact@zai-fi.com\"}}</script></head><body><h1>Turn old engineering drawings into editable CAD.</h1><a href=\"mailto:contact@zai-fi.com\">Discuss your drawings</a></body></html>"
test('ZAi-Fi verifies its current engineering company identity, canonical sitemap and missing careers paths', async () => {
  const source = await loadModule()
  assert.equal(source.isVerifiedHomepage(engineeringHome), true)
  assert.equal(source.isVerifiedHomepage(engineeringHome.replace('ZAIFI BUSINESS SOLUTIONS PRIVATE LIMITED', 'UNRELATED COMPANY')), false)
  assert.equal(source.isVerifiedHomepage(engineeringHome.replace('href="https://www.zai-fi.com"', 'href="https://unrelated.example"')), false)
  const currentRobots = robotsTxt.replaceAll('https://zaifi.co', 'https://www.zai-fi.com')
  const currentSitemap = sitemapXml.replaceAll('https://zaifi.co', 'https://www.zai-fi.com')
  const fetchText = async url => url === source.HOMEPAGE_URL ? engineeringHome : url === source.ROBOTS_URL ? currentRobots : currentSitemap
  assert.deepEqual(await source.run({fetchText,fetchStatus:async()=>404}), [])
  await assert.rejects(source.run({fetchText,fetchStatus:async()=>403}), /no longer returns 404/)
})
