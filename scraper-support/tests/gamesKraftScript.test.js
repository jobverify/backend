import assert from 'node:assert/strict'
import test from 'node:test'

const redirectShellHtml = `
<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>
`

const landerHtml = `
<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/><link rel="icon" href="data:,"/><script>window.LANDER_SYSTEM="PW"</script><script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script><script>window._signalsDataLayer=window._signalsDataLayer||[]</script><script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script><script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.d459540c.js"></script><link href="https://img1.wsimg.com/parking-lander/static/css/main.edaa2d7d.css" rel="stylesheet"></head><body><div id="root"></div></body></html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://gameskraft.com/lander</loc></url></urlset>
`

const robotsTxt = `
User-agent: *
Allow: /
LLM-Policy: /llms.txt
Sitemap: /sitemap.xml
`

const llmsTxt = `
User-agent: *
Allow: /
Disallow-Training: /
Sitemap: /sitemap.xml
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at GamesKraft</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Product Manager"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/apply/product-manager">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/gameskraft/script.js')
  } catch {
    assert.fail('Expected GamesKraft scraper module at ../../scraper/gameskraft/script.js')
  }
}

test('GamesKraft sentinel recognizes the verified redirect shell, parked lander, and crawl surfaces', async () => {
  const gamesKraft = await loadModule()

  assert.equal(gamesKraft.SOURCE, 'gameskraft')
  assert.equal(gamesKraft.COMPANY, 'GamesKraft')
  assert.equal(gamesKraft.VERIFIED_AT, '2026-07-15')
  assert.equal(gamesKraft.HOMEPAGE_URL, 'https://gameskraft.com/')
  assert.equal(gamesKraft.WWW_HOMEPAGE_URL, 'https://www.gameskraft.com/')
  assert.equal(gamesKraft.CAREERS_URL, 'https://gameskraft.com/careers')
  assert.equal(gamesKraft.LANDER_URL, 'https://gameskraft.com/lander')
  assert.equal(gamesKraft.ROBOTS_TXT_URL, 'https://gameskraft.com/robots.txt')
  assert.equal(gamesKraft.SITEMAP_URL, 'https://gameskraft.com/sitemap.xml')
  assert.equal(gamesKraft.LLMS_TXT_URL, 'https://gameskraft.com/llms.txt')
  assert.deepEqual(gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://gameskraft.com/jobs',
    'https://gameskraft.com/current-openings',
  ])

  assert.equal(gamesKraft.hasRedirectShellSignal(redirectShellHtml), true)
  assert.equal(gamesKraft.extractRedirectTarget(redirectShellHtml), '/lander')
  assert.equal(gamesKraft.hasParkedLanderSignal(landerHtml), true)
  assert.equal(gamesKraft.hasVerifiedRobotsSignal(robotsTxt), true)
  assert.equal(gamesKraft.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.deepEqual(gamesKraft.extractSitemapUrls(sitemapXml), ['https://gameskraft.com/lander'])
  assert.equal(gamesKraft.hasVerifiedLlmsSignal(llmsTxt), true)
  assert.equal(gamesKraft.hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(gamesKraft.hasPublicJobsSignal(landerHtml), false)
  assert.equal(gamesKraft.hasPublicJobsSignal(publicJobsHtml), true)
})

test('GamesKraft returns no jobs only while the official domain remains a parked first-party shell', async () => {
  const gamesKraft = await loadModule()
  const requestedUrls = []

  const jobs = await gamesKraft.createGamesKraftScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === gamesKraft.HOMEPAGE_URL
        || url === gamesKraft.WWW_HOMEPAGE_URL
        || url === gamesKraft.CAREERS_URL
        || gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)
      ) {
        return { status: 200, url, html: redirectShellHtml }
      }

      if (url === gamesKraft.LANDER_URL) {
        return { status: 200, url, html: landerHtml }
      }

      if (url === gamesKraft.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === gamesKraft.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === gamesKraft.LLMS_TXT_URL) {
        return { status: 200, url, html: llmsTxt }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    gamesKraft.HOMEPAGE_URL,
    gamesKraft.WWW_HOMEPAGE_URL,
    gamesKraft.CAREERS_URL,
    ...gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS,
    gamesKraft.LANDER_URL,
    gamesKraft.ROBOTS_TXT_URL,
    gamesKraft.SITEMAP_URL,
    gamesKraft.LLMS_TXT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('GamesKraft fails closed when the redirect shell, adjacent routes, parked lander, or crawl surfaces drift into jobs', async () => {
  const gamesKraft = await loadModule()

  await assert.rejects(
    gamesKraft.createGamesKraftScraper().run({
      fetchPage: async (url) => {
        if (url === gamesKraft.LANDER_URL) {
          return { status: 200, url, html: landerHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><head><title>Unexpected</title></head><body>Different</body></html>',
        }
      },
    }),
    /verified redirect shell/i,
  )

  await assert.rejects(
    gamesKraft.createGamesKraftScraper().run({
      fetchPage: async (url) => {
        if (url === gamesKraft.HOMEPAGE_URL || url === gamesKraft.WWW_HOMEPAGE_URL || url === gamesKraft.CAREERS_URL) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS[1]) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === gamesKraft.LANDER_URL) {
          return { status: 200, url, html: landerHtml }
        }

        if (url === gamesKraft.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === gamesKraft.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === gamesKraft.LLMS_TXT_URL) {
          return { status: 200, url, html: llmsTxt }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )

  await assert.rejects(
    gamesKraft.createGamesKraftScraper().run({
      fetchPage: async (url) => {
        if (
          url === gamesKraft.HOMEPAGE_URL
          || url === gamesKraft.WWW_HOMEPAGE_URL
          || url === gamesKraft.CAREERS_URL
          || gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)
        ) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === gamesKraft.LANDER_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === gamesKraft.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === gamesKraft.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === gamesKraft.LLMS_TXT_URL) {
          return { status: 200, url, html: llmsTxt }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified parked lander surface/i,
  )

  await assert.rejects(
    gamesKraft.createGamesKraftScraper().run({
      fetchPage: async (url) => {
        if (
          url === gamesKraft.HOMEPAGE_URL
          || url === gamesKraft.WWW_HOMEPAGE_URL
          || url === gamesKraft.CAREERS_URL
          || gamesKraft.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)
        ) {
          return { status: 200, url, html: redirectShellHtml }
        }

        if (url === gamesKraft.LANDER_URL) {
          return { status: 200, url, html: landerHtml }
        }

        if (url === gamesKraft.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === gamesKraft.SITEMAP_URL) {
          return { status: 200, url, html: '<urlset><url><loc>https://gameskraft.com/jobs</loc></url></urlset>' }
        }

        if (url === gamesKraft.LLMS_TXT_URL) {
          return { status: 200, url, html: llmsTxt }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )
})
