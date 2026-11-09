import assert from 'node:assert/strict'
import test from 'node:test'

const loadMdriftModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected mDrift scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>mDrift Technologies</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/products/domitos">Products</a>
        <a href="/services/product-platform-engineering">Services</a>
        <a href="/technologies">Technologies</a>
        <a href="/about-us">About Us</a>
        <a href="/blog">Resources</a>
        <a href="/contact-us">Contact Us</a>
      </nav>
      <script src="/static/js/mdrift.js"></script>
    </header>
    <main>
      <h1>Partner for Innovation</h1>
      <section>
        <h2>Our Services</h2>
        <p>Product and Platform Engineering</p>
        <p>IP Development and Research</p>
        <p>DevOps</p>
        <p>Artificial Intelligence</p>
      </section>
      <section>
        <h2>Our Tech Stack for your Projects</h2>
      </section>
    </main>
    <footer>
      <a href="/contact-us">Contact Us</a>
      <a href="mailto:contact@mdrift.com">contact@mdrift.com</a>
      <p>We were founded in May of 2013 with the aim of serving the R&D needs of startups and enterprises.</p>
      <p>© 2023 mDrift Technologies. All Rights Reserved.</p>
    </footer>
  </body>
</html>
`

const makeMissingRouteHtml = (pathname) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <title>Page not found at ${pathname}</title>
    <meta name="robots" content="NONE,NOARCHIVE" />
  </head>
  <body>
    <div id="summary">
      <h1>Page not found <span>(404)</span></h1>
      <table class="meta">
        <tr>
          <th>Request Method:</th>
          <td>GET</td>
        </tr>
        <tr>
          <th>Request URL:</th>
          <td>https://mdrift.com${pathname}</td>
        </tr>
      </table>
    </div>
    <div id="info">
      <p>Using the URLconf defined in <code>mysite.urls</code>, Django tried these URL patterns, in this order:</p>
    </div>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>mDrift Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://mdrift.com/careers/platform-engineer">Platform Engineer</a>
      <a href="https://jobs.lever.co/mdrift/platform-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const publicJobsBundleJs = `
window.__MDRIFT_CAREERS__ = true;
const applyUrl = "https://jobs.lever.co/mdrift/platform-engineer";
const careersPath = "/careers/platform-engineer";
`

test('mDrift sentinel recognizes the verified homepage, empty first-party script, and missing-route contract', async () => {
  const mdrift = await loadMdriftModule()

  assert.equal(mdrift.SOURCE, 'mdrift')
  assert.equal(mdrift.COMPANY, 'mDrift Technologies')
  assert.equal(mdrift.HOMEPAGE_URL, 'https://mdrift.com/')
  assert.equal(mdrift.SCRIPT_BUNDLE_URL, 'https://mdrift.com/static/js/mdrift.js')
  assert.equal(mdrift.ROBOTS_URL, 'https://mdrift.com/robots.txt')
  assert.equal(mdrift.SITEMAP_URL, 'https://mdrift.com/sitemap.xml')
  assert.deepEqual(mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://mdrift.com/careers',
    'https://mdrift.com/career',
    'https://mdrift.com/jobs',
    'https://mdrift.com/join-us',
    'https://mdrift.com/current-openings',
    'https://mdrift.com/openings',
    'https://mdrift.com/work-with-us',
  ])
  assert.deepEqual(mdrift.VERIFIED_MISSING_ROUTE_URLS, [
    mdrift.ROBOTS_URL,
    mdrift.SITEMAP_URL,
    ...mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.equal(mdrift.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(mdrift.hasHomepageBundleReference(officialHomepageHtml), true)
  assert.equal(mdrift.hasFirstPartyCareerLikeLink(officialHomepageHtml), false)
  assert.equal(mdrift.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(mdrift.hasVerifiedBundleSignal(''), true)
  assert.equal(mdrift.hasBundlePublicJobsSignal(''), false)
  assert.equal(mdrift.hasBundlePublicJobsSignal(publicJobsBundleJs), true)
  assert.equal(
    mdrift.isVerifiedMissingRoute(
      {
        status: 404,
        url: 'https://mdrift.com/careers/',
        html: makeMissingRouteHtml('/careers/'),
      },
      mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
    ),
    true,
  )
})

test('mDrift sentinel returns no jobs while the verified first-party no-public-careers surface stays intact', async () => {
  const mdrift = await loadMdriftModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await mdrift.createMdriftScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === mdrift.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === mdrift.ROBOTS_URL) {
        return { status: 404, url, html: makeMissingRouteHtml('/robots.txt') }
      }

      if (url === mdrift.SITEMAP_URL) {
        return { status: 404, url, html: makeMissingRouteHtml('/sitemap.xml') }
      }

      if (mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        const pathname = `${new URL(url).pathname.replace(/\/$/, '')}/`
        return {
          status: 404,
          url: `https://mdrift.com${pathname}`,
          html: makeMissingRouteHtml(pathname),
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === mdrift.SCRIPT_BUNDLE_URL) {
        return ''
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    mdrift.HOMEPAGE_URL,
    ...mdrift.VERIFIED_MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(requestedTexts, [mdrift.SCRIPT_BUNDLE_URL])
  assert.deepEqual(jobs, [])
})

test('mDrift sentinel fails closed when the homepage, first-party script, robots or sitemap surface, or checked routes drift', async () => {
  const mdrift = await loadMdriftModule()

  await assert.rejects(
    mdrift.createMdriftScraper().run({
      fetchPage: async (url) => {
        if (url === mdrift.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected shell</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => '',
    }),
    /official homepage/i,
  )

  await assert.rejects(
    mdrift.createMdriftScraper().run({
      fetchPage: async (url) => {
        if (url === mdrift.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${officialHomepageHtml}<a href="/careers/">Careers</a>`,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => '',
    }),
    /homepage now exposes a first-party careers path|homepage now appears to expose public jobs/i,
  )

  await assert.rejects(
    mdrift.createMdriftScraper().run({
      fetchPage: async (url) => {
        if (url === mdrift.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === mdrift.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /' }
        }

        if (url === mdrift.SITEMAP_URL) {
          return { status: 404, url, html: makeMissingRouteHtml('/sitemap.xml') }
        }

        if (mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          const pathname = `${new URL(url).pathname.replace(/\/$/, '')}/`
          return {
            status: 404,
            url: `https://mdrift.com${pathname}`,
            html: makeMissingRouteHtml(pathname),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => '',
    }),
    /robots\.txt or sitemap/i,
  )

  await assert.rejects(
    mdrift.createMdriftScraper().run({
      fetchPage: async (url) => {
        if (url === mdrift.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === mdrift.ROBOTS_URL) {
          return { status: 404, url, html: makeMissingRouteHtml('/robots.txt') }
        }

        if (url === mdrift.SITEMAP_URL) {
          return { status: 404, url, html: makeMissingRouteHtml('/sitemap.xml') }
        }

        if (url === mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url: 'https://mdrift.com/careers/',
            html: publicJobsHtml,
          }
        }

        if (mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          const pathname = `${new URL(url).pathname.replace(/\/$/, '')}/`
          return {
            status: 404,
            url: `https://mdrift.com${pathname}`,
            html: makeMissingRouteHtml(pathname),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => '',
    }),
    /no-public-careers route changed|public careers surface/i,
  )

  await assert.rejects(
    mdrift.createMdriftScraper().run({
      fetchPage: async (url) => {
        if (url === mdrift.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === mdrift.ROBOTS_URL) {
          return { status: 404, url, html: makeMissingRouteHtml('/robots.txt') }
        }

        if (url === mdrift.SITEMAP_URL) {
          return { status: 404, url, html: makeMissingRouteHtml('/sitemap.xml') }
        }

        if (mdrift.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          const pathname = `${new URL(url).pathname.replace(/\/$/, '')}/`
          return {
            status: 404,
            url: `https://mdrift.com${pathname}`,
            html: makeMissingRouteHtml(pathname),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => publicJobsBundleJs,
    }),
    /first-party script changed materially|public jobs surface/i,
  )
})
