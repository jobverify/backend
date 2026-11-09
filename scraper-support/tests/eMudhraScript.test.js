import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-in">
  <head>
    <title>eMudhra | Digital Signature & PKI Services in India</title>
  </head>
  <body>
    <main>
      <h1>Your Digital Trust and Cybersecurity, Powered by eMudhra</h1>
      <p>Sign, Secure, Succeed.</p>
    </main>
  </body>
</html>
`

const indiaCareersHtml = `
<!DOCTYPE html>
<html lang="en-in">
  <head>
    <title>Careers at eMudhra – Join Our Innovative Team - India</title>
    <meta
      name="description"
      content="Join eMudhra careers where innovation thrives. Explore job opportunities, grow your skills, and shape the future of digital trust. Available in India."
    />
  </head>
  <body>
    <button id="toggleMenu">India</button>
    <a class="scroll_down" href="https://emudhra.com/en/careers-open-positions" target="_blank">
      <p>Current Openings</p>
    </a>
    <a class="mt-3 scrollTo btn-primary careers-open-btn btn mt-4" href="https://emudhra.com/en/careers-open-positions">
      Explore Opportunities
    </a>
    <section class="careers-openings" id="careersForm">
      <span class="title-head">Current Openings</span>
      <h2 class="main-head">Open Positions</h2>
      <p>Looking to make an impact? Check out our open positions, we are eager to meet you!</p>
      <a class="btn btn-primary btn-banner btn-transparent mt-3" href="https://emudhra.com/en/careers-open-positions" target="_blank">
        <span class="btn-text fs-6">See all openings</span>
      </a>
    </section>
    <div id="footer-india"></div>
  </body>
</html>
`

const globalCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at eMudhra – Join Our Innovative Team - USA</title>
    <meta
      name="description"
      content="Join eMudhra careers where innovation thrives. Explore job opportunities, grow your skills, and shape the future of digital trust."
    />
  </head>
  <body>
    <a class="scroll_down" href="https://emudhra.com/en/careers-open-positions" target="_blank">
      <p>Current Openings</p>
    </a>
    <a class="scrollTo btn-primary careers-open-btn btn mt-4" href="https://emudhra.com/en/careers-open-positions" target="_blank">
      Explore Opportunities
    </a>
    <section class="careers-openings">
      <span class="title-head">Current Openings</span>
      <h2 class="main-head">Open Positions</h2>
      <a class="btn btn-primary btn-banner btn-transparent mt-3" href="https://emudhra.com/en/careers-open-positions" target="_blank">
        <span class="btn-text fs-6">See all openings</span>
      </a>
    </section>
  </body>
</html>
`

const brokenOpeningsHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Page Not Found | eMudhra</title>
  </head>
  <body>
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/">Go to Homepage</a>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Current Openings</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/emudhra/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://emudhra.com/en/careers</loc>
    <xhtml:link rel="alternate" hreflang="en-in" href="https://emudhra.com/en-in/careers"/>
  </url>
</urlset>
`

const loadEmudhraModule = async () => {
  try {
    return await import('../../scraper/emudhra/script.js')
  } catch {
    assert.fail('Expected eMudhra scraper module at ../../scraper/emudhra/script.js')
  }
}

test('eMudhra helpers stay pinned to the verified India careers surface and broken openings handoff', async () => {
  const emudhra = await loadEmudhraModule()

  assert.equal(emudhra.SOURCE, 'emudhra')
  assert.equal(emudhra.COMPANY, 'eMudhra')
  assert.equal(emudhra.OFFICIAL_BRAND_NAME, 'eMudhra')
  assert.equal(emudhra.VERIFIED_ON, '2026-08-15')
  assert.equal(emudhra.HOMEPAGE_URL, 'https://emudhra.com/en-in/')
  assert.equal(emudhra.CAREER_PAGE_URL, 'https://emudhra.com/en-in/careers')
  assert.equal(emudhra.GLOBAL_CAREER_PAGE_URL, 'https://emudhra.com/en/careers')
  assert.equal(emudhra.PUBLISHED_OPENINGS_URL, 'https://emudhra.com/en/careers-open-positions')
  assert.deepEqual(emudhra.CHECKED_BROKEN_OPENINGS_URLS, [
    'https://emudhra.com/en/careers-open-positions',
    'https://emudhra.com/en-in/careers-open-positions',
  ])
  assert.equal(emudhra.SITEMAP_URL, 'https://emudhra.com/sitemap.xml')
  assert.equal(emudhra.hasHomepageSignal(homepageHtml), true)
  assert.equal(emudhra.hasIndiaCareersSignal(indiaCareersHtml), true)
  assert.equal(emudhra.hasGlobalCareersSignal(globalCareersHtml), true)
  assert.equal(emudhra.hasBrokenOpeningsSignal({ status: 404, html: brokenOpeningsHtml }), true)
  assert.equal(emudhra.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(emudhra.hasPublicJobsSignal(brokenOpeningsHtml), false)
  assert.equal(emudhra.sitemapHasCareersRoute(sitemapXml), true)
  assert.equal(emudhra.sitemapListsOpeningsRoute(sitemapXml), false)
})

test('eMudhra returns [] only while the verified careers pages keep the broken first-party openings handoff', async () => {
  const emudhra = await loadEmudhraModule()
  const requestedUrls = []

  const jobs = await emudhra.createEmudhraScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === emudhra.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === emudhra.CAREER_PAGE_URL) {
        return { status: 200, url, html: indiaCareersHtml }
      }

      if (url === emudhra.GLOBAL_CAREER_PAGE_URL) {
        return { status: 200, url, html: globalCareersHtml }
      }

      if (emudhra.CHECKED_BROKEN_OPENINGS_URLS.includes(url)) {
        return { status: 404, url, html: brokenOpeningsHtml }
      }

      if (url === emudhra.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      throw new Error(`Unexpected eMudhra URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    emudhra.HOMEPAGE_URL,
    emudhra.CAREER_PAGE_URL,
    emudhra.GLOBAL_CAREER_PAGE_URL,
    ...emudhra.CHECKED_BROKEN_OPENINGS_URLS,
    emudhra.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('eMudhra falls back to browser-backed page fetches when direct TLS validation fails', async () => {
  const emudhra = await loadEmudhraModule()
  const requestedUrls = []

  const jobs = await emudhra.createEmudhraScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(`direct:${url}`)
      throw new Error(
        'fetch failed | unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca',
      )
    },
    fetchBrowserPage: async (url) => {
      requestedUrls.push(`browser:${url}`)

      if (url === emudhra.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === emudhra.CAREER_PAGE_URL) {
        return { status: 200, url, html: indiaCareersHtml }
      }

      if (url === emudhra.GLOBAL_CAREER_PAGE_URL) {
        return { status: 200, url, html: globalCareersHtml }
      }

      if (emudhra.CHECKED_BROKEN_OPENINGS_URLS.includes(url)) {
        return { status: 404, url, html: brokenOpeningsHtml }
      }

      if (url === emudhra.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      throw new Error(`Unexpected eMudhra URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    `direct:${emudhra.HOMEPAGE_URL}`,
    `browser:${emudhra.HOMEPAGE_URL}`,
    `direct:${emudhra.CAREER_PAGE_URL}`,
    `browser:${emudhra.CAREER_PAGE_URL}`,
    `direct:${emudhra.GLOBAL_CAREER_PAGE_URL}`,
    `browser:${emudhra.GLOBAL_CAREER_PAGE_URL}`,
    `direct:${emudhra.CHECKED_BROKEN_OPENINGS_URLS[0]}`,
    `browser:${emudhra.CHECKED_BROKEN_OPENINGS_URLS[0]}`,
    `direct:${emudhra.CHECKED_BROKEN_OPENINGS_URLS[1]}`,
    `browser:${emudhra.CHECKED_BROKEN_OPENINGS_URLS[1]}`,
    `direct:${emudhra.SITEMAP_URL}`,
    `browser:${emudhra.SITEMAP_URL}`,
  ])
  assert.deepEqual(jobs, [])
})

test('eMudhra returns an empty result when the verified careers surfaces are temporarily timeout-blocked', async () => {
  const emudhra = await loadEmudhraModule()

  const jobs = await emudhra.createEmudhraScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted addresses: 18.245.86.16:443, 18.245.86.80:443, 18.245.86.2:443, 18.245.86.50:443, timeout: 10000ms)',
      )
    },
    fetchBrowserPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted addresses: 18.245.86.16:443, 18.245.86.80:443, 18.245.86.2:443, 18.245.86.50:443, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})

test('eMudhra fails closed when the verified careers or broken-openings contract drifts', async () => {
  const emudhra = await loadEmudhraModule()

  await assert.rejects(
    emudhra.createEmudhraScraper().run({
      fetchPage: async (url) => {
        if (url === emudhra.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected eMudhra URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    emudhra.createEmudhraScraper().run({
      fetchPage: async (url) => {
        if (url === emudhra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === emudhra.CAREER_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected eMudhra URL: ${url}`)
      },
    }),
    /india careers page no longer matches/i,
  )

  await assert.rejects(
    emudhra.createEmudhraScraper().run({
      fetchPage: async (url) => {
        if (url === emudhra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === emudhra.CAREER_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === emudhra.GLOBAL_CAREER_PAGE_URL) {
          return { status: 200, url, html: globalCareersHtml }
        }

        if (url === emudhra.CHECKED_BROKEN_OPENINGS_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected eMudhra URL: ${url}`)
      },
    }),
    /broken openings route changed/i,
  )

  await assert.rejects(
    emudhra.createEmudhraScraper().run({
      fetchPage: async (url) => {
        if (url === emudhra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === emudhra.CAREER_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === emudhra.GLOBAL_CAREER_PAGE_URL) {
          return { status: 200, url, html: globalCareersHtml }
        }

        if (emudhra.CHECKED_BROKEN_OPENINGS_URLS.includes(url)) {
          return { status: 404, url, html: brokenOpeningsHtml }
        }

        if (url === emudhra.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://emudhra.com/en/careers-open-positions</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected eMudhra URL: ${url}`)
      },
    }),
    /sitemap changed/i,
  )
})

const currentCareersMap = '<urlset><url><loc>https://emudhra.com/en/careers</loc><xhtml:link rel="alternate" hreflang="en" href="https://emudhra.com/en/careers"/><xhtml:link rel="alternate" hreflang="x-default" href="https://emudhra.com/en/careers"/></url></urlset>'
const indexedSitemapFixture = async (child = currentCareersMap, index = '<sitemapindex><sitemap><loc>https://emudhra.com/sitemap-pages.xml</loc></sitemap><sitemap><loc>https://emudhra.com/sitemap-blog.xml</loc></sitemap></sitemapindex>') => {
  const source = await loadEmudhraModule()
  return source.createEmudhraScraper().run({ fetchPage: async url => {
    if (url === source.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
    if (url === source.CAREER_PAGE_URL) return { status: 200, url, html: indiaCareersHtml }
    if (url === source.GLOBAL_CAREER_PAGE_URL) return { status: 200, url, html: globalCareersHtml }
    if (source.CHECKED_BROKEN_OPENINGS_URLS.includes(url)) return { status: 404, url, html: brokenOpeningsHtml }
    if (url === source.SITEMAP_URL) return { status: 200, url, html: index }
    if (url === 'https://emudhra.com/sitemap-pages.xml') return { status: 200, url, html: child }
    if (url === 'https://emudhra.com/sitemap-blog.xml') return { status: 200, url, html: '<urlset><url><loc>https://emudhra.com/en/blog</loc></url></urlset>' }
    throw Error('Unexpected sitemap URL ' + url)
  } })
}

test('eMudhra follows the verified official sitemap index and current global careers alternates', async () => {
  assert.deepEqual(await indexedSitemapFixture(), [])
})

test('eMudhra rejects new openings in child maps and off-host sitemap index URLs', async () => {
  await assert.rejects(indexedSitemapFixture(currentCareersMap.replace('</urlset>', '<url><loc>https://emudhra.com/en/careers-open-positions</loc></url></urlset>')), /sitemap changed/)
  await assert.rejects(indexedSitemapFixture(currentCareersMap, '<sitemapindex><sitemap><loc>https://other.example/sitemap-pages.xml</loc></sitemap></sitemapindex>'), /sitemap changed/)
})
