import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Punt Partners scraper module at ./script.js')
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Punt Partners</title>
    <link rel="canonical" href="https://punt.partners/" />
  </head>
  <body>
    <nav>
      <a href="https://punt.partners/overview/">Overview</a>
      <a href="https://shelfradar.ai/">Shelf Radar</a>
      <a href="https://punt.partners/creative/">Punt Creative</a>
      <a href="https://findfables.ai/">FablesAI</a>
      <a href="https://aristok.com/">Aristok</a>
      <a href="https://punt.partners/newsroom/">Newsroom</a>
      <a href="https://punt.partners/team/">Team</a>
      <a href="https://punt.partners/partners/">Partners</a>
      <a href="https://punt.partners/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1>WE enable growth by leveraging tech and creativity</h1>
      <p>
        Punt Partners mission is to enable brands to succeed by leveraging technology with
        creative storytelling to help build strong brands in a capital efficient manner.
      </p>
      <section>
        <h2>Shelf Radar</h2>
        <p>Ad Copilot for brands selling on Quick Commerce.</p>
      </section>
      <section>
        <h2>Punt Creative</h2>
        <p>Creative storytelling and execution.</p>
      </section>
      <section>
        <h2>FablesAI</h2>
        <p>Generative AI artists empowering brands to tell extraordinary stories.</p>
      </section>
      <section>
        <h2>Aristok</h2>
        <p>Scaling acquisitions with strategic expertise.</p>
      </section>
    </main>
  </body>
</html>
`

const TEAM_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Team &#8211; Punt Partners</title>
    <link rel="canonical" href="https://punt.partners/team/" />
  </head>
  <body>
    <main>
      <h1>Team</h1>
      <p>
        Welcome to the exceptional team at Punt. We are a dynamic group of brand aficionados,
        tech enthusiasts, design mavens united by our passion for creativity, innovation and
        delivering outstanding results.
      </p>
      <ul>
        <li>Madhu Sudhan - Co-founder</li>
        <li>Priyanka Agrawal - Co-founder</li>
        <li>Harsh Shah - Managing Director Punt Creative</li>
        <li>Aniket Khare - Co-Founder Aristok</li>
        <li>Kaushal Agrawal - Co-Founder Aristok</li>
        <li>Vishal Agarwal - Founder Attributics</li>
      </ul>
    </main>
  </body>
</html>
`

const PARTNERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Partners &#8211; Punt Partners</title>
    <link rel="canonical" href="https://punt.partners/partners/" />
  </head>
  <body>
    <main>
      <h1>Our investors</h1>
      <p>
        Punt Partners is backed by some of India's most prominent names from the world of media,
        advertising, marketing and internet.
      </p>
      <ul>
        <li>Aakrit Vaish - Co-Founder &amp; CEO Haptik</li>
        <li>Anupam Mittal - Founder People Group</li>
        <li>Ashish Hemrajani - Founder &amp; CEO BookMyShow</li>
      </ul>
    </main>
  </body>
</html>
`

const SITEMAP_INDEX_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://punt.partners/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://punt.partners/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://punt.partners/wp-sitemap-taxonomies-category-1.xml</loc></sitemap>
  <sitemap><loc>https://punt.partners/wp-sitemap-users-1.xml</loc></sitemap>
</sitemapindex>
`

const PAGE_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://punt.partners/sample-page/</loc></url>
  <url><loc>https://punt.partners/</loc></url>
  <url><loc>https://punt.partners/team/</loc></url>
  <url><loc>https://punt.partners/contact-us/</loc></url>
  <url><loc>https://punt.partners/newsroom/</loc></url>
  <url><loc>https://punt.partners/test/</loc></url>
  <url><loc>https://punt.partners/overview/</loc></url>
  <url><loc>https://punt.partners/partners/</loc></url>
  <url><loc>https://punt.partners/themartechredpill/</loc></url>
  <url><loc>https://punt.partners/landing-page/</loc></url>
  <url><loc>https://punt.partners/newsletter/</loc></url>
</urlset>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found &#8211; Punt Partners</title>
  </head>
  <body>
    <nav>
      <a href="https://punt.partners/newsroom/">Newsroom</a>
      <a href="https://punt.partners/team/">Team</a>
      <a href="https://punt.partners/partners">Partners</a>
      <a href="https://punt.partners/contact-us/">Contact Us</a>
      <a href="https://punt.partners/creative/">Punt Creative</a>
      <a href="https://findfables.ai/">FablesAI</a>
      <a href="https://aristok.com/">Aristok</a>
    </nav>
    <main>
      <h1>The page can&rsquo;t be found.</h1>
      <p>It looks like nothing was found at this location.</p>
    </main>
  </body>
</html>
`

test('Punt Partners sentinel pins the verified first-party zero-public-careers surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'puntpartners')
  assert.equal(scraper.COMPANY, 'Punt Partners')
  assert.equal(scraper.VERIFIED_AT, '2026-08-04')
  assert.equal(scraper.HOMEPAGE_URL, 'https://punt.partners/')
  assert.equal(scraper.TEAM_URL, 'https://punt.partners/team/')
  assert.equal(scraper.PARTNERS_URL, 'https://punt.partners/partners/')
  assert.equal(scraper.SITEMAP_INDEX_URL, 'https://punt.partners/wp-sitemap.xml')
  assert.equal(
    scraper.PAGE_SITEMAP_URL,
    'https://punt.partners/wp-sitemap-posts-page-1.xml',
  )
  assert.deepEqual(scraper.MISSING_ROUTE_URLS, [
    'https://punt.partners/careers',
    'https://punt.partners/careers/',
    'https://punt.partners/career',
    'https://punt.partners/career/',
    'https://punt.partners/jobs',
    'https://punt.partners/jobs/',
    'https://punt.partners/join-us',
    'https://punt.partners/work-with-us',
    'https://punt.partners/current-openings',
    'https://punt.partners/vacancies',
  ])

  assert.equal(scraper.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(scraper.hasOfficialTeamSignal(TEAM_HTML), true)
  assert.equal(scraper.hasOfficialPartnersSignal(PARTNERS_HTML), true)
  assert.equal(scraper.hasOfficialSitemapIndexSignal(SITEMAP_INDEX_XML), true)
  assert.equal(scraper.hasOfficialPageSitemapSignal(PAGE_SITEMAP_XML), true)
  assert.equal(
    scraper.isVerifiedMissingRoute({ status: 404, html: MISSING_ROUTE_HTML }),
    true,
  )
  assert.equal(
    scraper.isVerifiedMissingRoute({
      status: 404,
      html: MISSING_ROUTE_HTML.replace(
        'href="https://punt.partners/partners/"',
        'href="https://punt.partners/partners"',
      ),
    }),
    true,
  )
})

test('Punt Partners sentinel returns [] only while the verified first-party surface stays job-free', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createPuntPartnersScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
      if (url === scraper.TEAM_URL) return { status: 200, url, html: TEAM_HTML }
      if (url === scraper.PARTNERS_URL) return { status: 200, url, html: PARTNERS_HTML }
      if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
      if (url === scraper.PAGE_SITEMAP_URL) return { status: 200, url, html: PAGE_SITEMAP_XML }
      if (scraper.MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: MISSING_ROUTE_HTML }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.TEAM_URL,
    scraper.PARTNERS_URL,
    scraper.SITEMAP_INDEX_URL,
    scraper.PAGE_SITEMAP_URL,
    ...scraper.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Punt Partners sentinel returns [] when the verified first-party surfaces are temporarily unreachable', async () => {
  const scraper = await loadModule()

  const jobs = await scraper.createPuntPartnersScraper().run({
    fetchPage: async (url) => ({
      status: null,
      url,
      html: null,
      errorKind: 'timeout',
      errorMessage: 'Could not connect to server',
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Punt Partners sentinel fails closed when the verified public surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createPuntPartnersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML.replace(
              '<a href="https://punt.partners/contact-us/">Contact Us</a>',
              '<a href="https://punt.partners/careers/">Careers</a>',
            ),
          }
        }

        if (url === scraper.TEAM_URL) return { status: 200, url, html: TEAM_HTML }
        if (url === scraper.PARTNERS_URL) return { status: 200, url, html: PARTNERS_HTML }
        if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
        if (url === scraper.PAGE_SITEMAP_URL) return { status: 200, url, html: PAGE_SITEMAP_XML }
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /verified homepage no longer matches/i,
  )

  await assert.rejects(
    scraper.createPuntPartnersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === scraper.TEAM_URL) return { status: 200, url, html: TEAM_HTML }
        if (url === scraper.PARTNERS_URL) return { status: 200, url, html: PARTNERS_HTML }
        if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
        if (url === scraper.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: PAGE_SITEMAP_XML.replace(
              '</urlset>',
              '<url><loc>https://punt.partners/careers/</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /verified page sitemap no longer matches/i,
  )

  await assert.rejects(
    scraper.createPuntPartnersScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === scraper.TEAM_URL) return { status: 200, url, html: TEAM_HTML }
        if (url === scraper.PARTNERS_URL) return { status: 200, url, html: PARTNERS_HTML }
        if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
        if (url === scraper.PAGE_SITEMAP_URL) return { status: 200, url, html: PAGE_SITEMAP_XML }
        if (url === 'https://punt.partners/careers') {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Careers - Punt Partners</title></head>
                <body>
                  <h1>Join Punt Partners</h1>
                  <p>Apply now for open positions.</p>
                </body>
              </html>
            `,
          }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /missing-route validation failed/i,
  )
})
