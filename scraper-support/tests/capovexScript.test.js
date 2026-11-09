import assert from 'node:assert/strict'
import test from 'node:test'

const currentBundlePath = '/assets/index-DZxHlAG4.js'
const currentBundleUrl = 'https://capovex.com/assets/index-DZxHlAG4.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Capovex International</title>
    <meta name="keywords" content="crypto staking platform, cryptocurrency staking, staking rewards, earn passive income crypto, blockchain staking" />
    <meta name="author" content="capovex" />
    <link rel="canonical" href="https://www.capovex.com/" />
    <meta property="og:title" content="Secure Crypto Staking Platform" />
    <meta property="og:description" content="Stake your crypto securely and earn passive income with high rewards and low fees." />
    <meta name="twitter:description" content="Earn passive income by staking cryptocurrency securely." />
    <script type="module" crossorigin src="${currentBundlePath}"></script>
  </head>
  <body>
    <div id="root"></div>
    <script id="zsiqscript">window.$zoho = true</script>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://capovex.com/</loc></url>
  <url><loc>https://capovex.com/about</loc></url>
</urlset>
`

const bundleText = `
const routes = [
  { path:"/about-us" },
  { path:"/contact-us" },
  { path:"/help-center" },
]
`

const loadModule = async () => {
  try {
    return await import('../../scraper/capovex/script.js')
  } catch {
    assert.fail('Expected Capovex scraper module at ../../scraper/capovex/script.js')
  }
}

test('Capovex accepts the verified homepage shell with a rotated bundle hash', async () => {
  const capovex = await loadModule()

  assert.equal(capovex.extractBundleAssetPath(homepageHtml), currentBundlePath)
  assert.equal(capovex.isVerifiedBundleAssetPath(currentBundlePath), true)
  assert.equal(capovex.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(capovex.hasPublicJobsSignal(homepageHtml), false)
})

test('Capovex run resolves the live bundle asset URL from the homepage shell', async () => {
  const capovex = await loadModule()
  const fetchedPages = []
  const fetchedTexts = []

  const jobs = await capovex.createCapovexScraper().run({
    fetchPage: async (url) => {
      fetchedPages.push(url)

      if (url === capovex.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === capovex.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (capovex.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }

      throw new Error(`Unexpected Capovex page URL: ${url}`)
    },
    fetchText: async (url) => {
      fetchedTexts.push(url)

      if (url === currentBundleUrl) return bundleText
      throw new Error(`Unexpected Capovex bundle URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(fetchedTexts, [currentBundleUrl])
  assert.deepEqual(fetchedPages, [
    capovex.HOMEPAGE_URL,
    capovex.SITEMAP_URL,
    ...capovex.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
})

test('Capovex fails closed when the homepage bundle asset no longer matches the verified pattern', async () => {
  const capovex = await loadModule()
  const brokenHomepageHtml = homepageHtml.replace(currentBundlePath, '/assets/home.js')

  assert.equal(capovex.isVerifiedBundleAssetPath('/assets/home.js'), false)
  assert.equal(capovex.hasOfficialHomepageSignal(brokenHomepageHtml), false)

  await assert.rejects(
    capovex.createCapovexScraper().run({
      fetchPage: async (url) => {
        if (url === capovex.HOMEPAGE_URL) {
          return { status: 200, url, html: brokenHomepageHtml }
        }

        throw new Error(`Unexpected Capovex page URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )
})
